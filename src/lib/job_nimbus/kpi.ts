import Graph from "graphology";
import type { JobStatusRegistry, JobStatus, JnActivity } from "./api";

function parseGraphSettings(settingsStr: string, statuses: JobStatusRegistry): Record<string, Set<JobStatus>> {
    // create a map of the each status name to the status object
    let statusByName: Record<string, JobStatus> = {};
    for (const status of Object.values(statuses)) {
        statusByName[status.name] = status;
    }

    // create the status groups
    const invalidStatusNames: Set<string> = new Set();
    const statusGroups: Record<string, Set<JobStatus>> = {};
    for (const line of settingsStr.trim().split('\n')) {
        const split = line.split(':', 2).map(s => s.trim());
        const [nickname, namesStr] = split.length === 2 ? split : [split[0], split[0]];
        const statusesInGroup: Set<JobStatus> = new Set();
        for (const name of namesStr.split(',').map(s => s.trim())) {
            if (statusByName.hasOwnProperty(name)) {
                statusesInGroup.add(statusByName[name]);
            } else {
                invalidStatusNames.add(name);
            }
        }
        statusGroups[nickname] = statusesInGroup;
    }

    if (invalidStatusNames.size > 0) {
        console.warn("Invalid status names: " + Array.from(invalidStatusNames).join(', '));
    }

    return statusGroups;
}

type StatusHistoryEntry = {
    timestamp: Date,
    status: JobStatus | null,
};

// Construct job status history from activities
function constructJobStatusHistory(activities: JnActivity[]): StatusHistoryEntry[] {
    const sortedActivities = [...activities].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    let history: StatusHistoryEntry[] = [];
    for (const activity of sortedActivities) {
        if (activity.type === "job_created") {
            history.push({ timestamp: activity.timestamp, status: null });
        } else if (activity.type === "status_changed") {
            // check the old status to ensure consistency
            if (history.length > 0) {
                const lastEntry = history.at(-1)!;
                if (lastEntry?.status === null) {
                    lastEntry.status = activity.oldStatus;
                } else if (lastEntry.status !== activity.oldStatus) {
                    console.warn(
                        `Job status history inconsistency detected: at ${activity.timestamp}, ` +
                        `the old status was ${activity.oldStatus.name}, but the previous entry ` +
                        `in the history was ${lastEntry.status.name}`,
                    );
                }
            }
            history.push({ timestamp: activity.timestamp, status: activity.newStatus });
        }
    }

    // if the latest status cannot be inferred from the status changes, add a final status
    // if (history.length > 0) {
    //     const lastEntry = history.at(-1)!;
    //     if (lastEntry.status === null) {
    //         lastEntry.status = currentStatus;
    //     } else if (lastEntry.status !== currentStatus) {
    //         console.warn(
    //             `Job status history inconsistency detected: at ${lastEntry.timestamp}, ` +
    //             `the status was ${lastEntry.status.name}, but the current status is ${currentStatus.name}`,
    //         );
    //     }
    // }

    return history;
}

export interface KpiSankeyData {
    nodeNames: string[],
    sourceIds: number[],
    targetIds: number[],
    jobs: string[][],
    averageDurationMs: number[],
}

export async function generateKpiGraph(
    settingsStr: string,
    statuses: JobStatusRegistry,
    activitiesByJobJnid: { [jobJnid: string]: JnActivity[] }
): Promise<KpiSankeyData> {
    const statusGroups = parseGraphSettings(settingsStr, statuses);

    let jobGraph = new JobGraphEmbedding(statusGroups, true);
    let invisibleJobs: string[] = [];
    for (const [jobJnid, activities] of Object.entries(activitiesByJobJnid)) {
        const statusHistory = constructJobStatusHistory(activities);
        const numEdges = jobGraph.addJob(jobJnid, statusHistory);
        if (numEdges === 0) {
            invisibleJobs.push(jobJnid);
        }
    }

    return jobGraph.calculateSankeyData();
}

class JobGraphEmbedding {
    // Maps each status id to the name of the node that corresponds to that status.
    private statusToNode: Partial<Record<number, string>>;
    private removeCycles: boolean;
    private graph: Graph<{}, { jobJnids: string[], totalDurationMs: number }>;

    constructor(statusGroups: { [statusGroup: string]: Set<JobStatus> }, removeCycles: boolean) {
        let statusToNode: { [statusId: number]: string } = {};
        for (const [nickname, statuses] of Object.entries(statusGroups)) {
            for (const status of statuses) {
                statusToNode[status.id] = nickname;
            }
        }
        this.statusToNode = statusToNode;

        this.removeCycles = removeCycles;

        // initialize the graph
        this.graph = new Graph();
        // add a node for every status group being tracked
        for (const [nickname, _] of Object.entries(statusGroups)) {
            this.graph.addNode(nickname);
        }
        // add a node for the start status
        this.graph.addNode(null);
    }

    // Returns the number of edges added to the graph as a result of adding this
    // job.
    addJob(jobJnid: string, statusHistory: StatusHistoryEntry[]): number {
        // convert the history of statuses to a sequence of nodes
        const nodeHistory = (() => {
            let nodeHistory: { timestamp: Date, nodeName: string }[] = [];
            let seenNodes = new Set<string>();
            let lastNode: string | null = null;
            for (const { timestamp, status } of statusHistory) {
                if (status == null) {
                    continue;
                }
                const nodeName: string | undefined = this.statusToNode[status.id];
                if (nodeName !== undefined && nodeName !== lastNode) {
                    if (this.removeCycles && seenNodes.has(nodeName)) {
                        // we've seen this node before, so remove the cycle
                        while (nodeHistory.at(-1)!.nodeName !== nodeName) {
                            const { nodeName } = nodeHistory.pop()!;
                            seenNodes.delete(nodeName);
                        }
                    } else {
                        // we've never seen this node before
                        seenNodes.add(nodeName);
                        nodeHistory.push({ timestamp, nodeName });
                    }
                    lastNode = nodeName;
                }
            }
            if (this.removeCycles) {
                // assert no cycles in the node history
                let seenNodes = new Set<string>();
                for (const { nodeName } of nodeHistory) {
                    if (seenNodes.has(nodeName)) {
                        throw new Error(`Cycle detected in node history: ${nodeName}`);
                    }
                    seenNodes.add(nodeName);
                }
            }
            return nodeHistory;
        })();

        // now iterate through the list of nodes and add them to the graph
        let lastTs = nodeHistory[0].timestamp;
        let lastNode: string | null = null;
        for (const { timestamp, nodeName } of nodeHistory) {
            // add an edge for this status
            this.graph.updateEdge(
                lastNode,
                nodeName,
                attr => {
                    return {
                        jobJnids: [...(attr.jobJnids ?? []), jobJnid],
                        totalDurationMs: (attr.totalDurationMs ?? 0) + (timestamp.getTime() - lastTs.getTime()),
                    };
                },
            );

            lastTs = timestamp;
            lastNode = nodeName;
        }

        return nodeHistory.length;
    }

    calculateSankeyData(): KpiSankeyData {
        // assign a unique id to each node in the graph
        const nodeNameToId: Record<string, number> = {};
        const nodeNames: string[] = [];
        let nextId = 0;
        this.graph.forEachNode((nodeName) => {
            nodeNameToId[nodeName] = nextId++;
            nodeNames.push(nodeName);
        });

        let sourceIds: number[] = [];
        let targetIds: number[] = [];
        let jobs: string[][] = [];
        let averageDurationMs: number[] = [];

        this.graph.forEachEdge((_, attr, source, target) => {
            sourceIds.push(nodeNameToId[source]);
            targetIds.push(nodeNameToId[target]);
            jobs.push(attr.jobJnids);
            averageDurationMs.push(attr.totalDurationMs / attr.jobJnids.length);
        });

        return {
            nodeNames,
            sourceIds,
            targetIds,
            jobs,
            averageDurationMs,
        };
    }
}
