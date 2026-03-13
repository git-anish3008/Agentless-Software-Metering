//ManagedIdentityCredential: The tool that creates your digital ID badge.
//LogsQueryClient: The tool that lets you ask Azure's Log Analytics for data.

const { ManagedIdentityCredential } = require("@azure/identity"); //const {a} = require("b") is a way to import specific tools (a) from a package (b). In this case, we're importing the ManagedIdentityCredential tool from the @azure/identity package.
const { LogsQueryClient } = require("@azure/monitor-query"); // Similarly, we're importing the LogsQueryClient tool from the @azure/monitor-query package.

//context & req: These are two packages of data Azure hands to your script. req (Request) contains info about the person calling the API. 
//context allows you to talk to the Azure server itself (like writing to the logs with context.log).

module.exports = async function (context, req) {
    context.log('API Request received: Fetching unused licenses.');

    // 2. We MUST use that exact same ManagedIdentity tool here!
    const credential = new ManagedIdentityCredential();
    const logsQueryClient = new LogsQueryClient(credential);

    // 2. Your Log Analytics Workspace ID
    const workspaceId = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    // 3. The KQL Query to calculate usage
    // We summarize the data to find the absolute LAST time the app was opened, 
    // and then calculate how many days it has been since that exact moment.
    const kqlQuery = `
        SoftwareMeteringData_CL
        | summarize LastUsed = max(Timestamp_t) by ComputerName_s, UserName_s, Application_s
        | extend DaysUnused = datetime_diff('day', now(), LastUsed)
        | project ComputerName_s, UserName_s, Application_s, LastUsed, DaysUnused
        | order by DaysUnused desc
    `;

    try {
        // Query the workspace looking back over the last 90 days (P90D)
        const result = await logsQueryClient.queryWorkspace(workspaceId, kqlQuery, { duration: "P90D" });

        // 4. Format Azure's messy data into a clean JSON array for your dashboard
        let formattedResults = [];
        if (result.tables && result.tables.length > 0) 
            {
            const table = result.tables[0];
            table.rows.forEach(row => {
                let rowData = {};
                // FIX: Changed columnDefinitions to columnDescriptors
                table.columnDescriptors.forEach((col, index) => {
                    rowData[col.name] = row[index];
                });
                formattedResults.push(rowData);
            });
        }

        // 5. Send the clean data back to the browser
        context.res = {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                // This allows your future HTML dashboard to read the data without security blocks
                "Access-Control-Allow-Origin": "*" 
            },
            body: formattedResults
        };

    } catch (error) {
        context.log.error("Database query failed:", error);
        context.res = {
            status: 500,
            body: { error: "Failed to fetch telemetry data from Azure." }
        };
    }
}
