# What is it?

Ahitool is a data analytics tool that integrates with JobNimbus to provide
insights on job flows and KPIs. You can visit the tool
[here](https://ahitool.andrechen.org).

# Current features

## Sales KPIs

This tool pulls in every job and related activity from the JobNimbus
database. It computes each job's history of moving through statuses such as
"Lead Acquired" or "Appointment Made", and creates a generalized Sankey diagram
showing the flow of jobs and how long each status transition takes. Users may
add filters to view analytics of only a specific subset of jobs (e.g. to analyze
the effectiveness of a lead source), and customize the definition of the status
groups that define visible transitions on the generated diagram.

# Planned features

## Sales KPI

- Add way to filter jobs by business branch.
- Add display of all jobs that make a transition.
- Add distribution visualizer for status transition duration.
- Port integration with Google Sheets (currently desktop only).

## Additional tools

- View all accounts receivable in their amounts and sorted by status.
- Search for previous jobs by geolocation and job features.
