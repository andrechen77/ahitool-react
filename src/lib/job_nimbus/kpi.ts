import Graph from "graphology";
import type { JobStatus, JnActivity, JobBaseData } from "./domain";

type StatusHistoryEntry = {
    timestamp: Date,
    status: string | null,
};

// Construct job status history from activities
function constructJobStatusHistory(baseData: JobBaseData, activities: JnActivity[]): { history: StatusHistoryEntry[], inconsistencies: number[] } {
    const sortedActivities = [...activities].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    let history: StatusHistoryEntry[] = [];
    let inconsistencies: number[] = [];
    for (const activity of sortedActivities) {
        if (activity.type === "job_created") {
            history.push({ timestamp: activity.timestamp, status: null });
        } else if (activity.type === "status_changed") {
            // check the old status to ensure consistency
            if (history.length > 0) {
                const lastEntry = history.at(-1)!;
                if (lastEntry.status === null) {
                    lastEntry.status = activity.oldStatusName;
                } else if (lastEntry.status !== activity.oldStatusName) {
                    inconsistencies.push(history.length);
                }
            }
            history.push({ timestamp: activity.timestamp, status: activity.newStatusName });
        }
    }

    // check consistency of the current status
    const lastEntry = history.at(-1);
    const currentStatus = baseData.status;
    const currentStatusModDate = baseData.statusModDate;
    if (lastEntry) {
        if (lastEntry.status === null) {
            // our history has a missing status; fill it in with the current status
            lastEntry.status = currentStatus.name;
        } else if (lastEntry.status !== currentStatus.name) {
            // our history's last entry is inconsistent with the current status.
            if (currentStatusModDate && currentStatusModDate > lastEntry.timestamp) {
                // we can add an additional entry to make it consistent again
                history.push({ timestamp: currentStatusModDate, status: currentStatus.name });
            } else {
                // we cannot add an additional entry to make it consistent again.
                // throw up our hands
                inconsistencies.push(history.length);
            }
        }
    } else {
        // add an additional entry for the current status
        const timestamp = currentStatusModDate ?? baseData.createdDate;
        history.push({ timestamp, status: currentStatus.name });
    }

    return { history, inconsistencies };
}

export interface KpiSankeyData {
    nodeNames: string[],
    sourceIds: number[],
    targetIds: number[],
    jobs: string[][],
    averageDurationMs: number[],
}

export async function generateKpiGraph(
    statusGroups: Record<string, string[]>,
    activitiesByJobJnid: { [jobJnid: string]: JnActivity[] },
    jobsByJnid: { [jobJnid: string]: JobBaseData },
): Promise<{ data: KpiSankeyData, invisibleJobs: string[] }> {
    let jobGraph = new JobGraphEmbedding(statusGroups, true);
    let invisibleJobs: string[] = [];
    for (const [jobJnid, job] of Object.entries(jobsByJnid)) {
        const activities = activitiesByJobJnid[jobJnid] ?? [];
        const { history, inconsistencies } = constructJobStatusHistory(job, activities);
        for (const inconsistency of inconsistencies) {
            if (inconsistency === history.length) {
                console.warn(`Job status history inconsistency detected for job ${jobJnid}: final status does not match history`)
            } else {
                console.warn(`Job status history inconsistency detected for job ${jobJnid}: at ${history[inconsistency].timestamp}`);
            }
        }
        const numEdges = jobGraph.addJob(jobJnid, history);
        if (numEdges === 0) {
            invisibleJobs.push(jobJnid);
        }
    }

    return { data: jobGraph.calculateSankeyData(), invisibleJobs };
}

class JobGraphEmbedding {
    // Maps each status name to the name of the node that corresponds to that status.
    private statusToNode: Partial<Record<string, string>>;
    private removeCycles: boolean;
    private graph: Graph<{}, { jobJnids: string[], totalDurationMs: number }>;

    constructor(statusGroups: { [statusGroup: string]: string[] }, removeCycles: boolean) {
        let statusToNode: { [statusId: string]: string } = {};
        for (const [nickname, statuses] of Object.entries(statusGroups)) {
            for (const status of statuses) {
                statusToNode[status] = nickname;
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
                const nodeName: string | undefined = this.statusToNode[status];
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

        if (nodeHistory.length === 0) {
            return 0;
        }

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
