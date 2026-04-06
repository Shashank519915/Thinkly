import { extractWorkflowTitle } from './lib/ai/utils';

const promptStr = `{
  "objective": "I get leads from salesforece, extract comapny data from them, eppend them to a google sheet and then schedule a meeting with their representative on microdift teams, i allot two of the employees in my team to take these meetings one meeting is held at 11 am and other at 4pm daily. they take the meeting and add notes in the microsoft teams meeting notes. i read them and based on that either set up a followup meeting or just send an appreciation email or anything that is mentioned in the notes specifically.",
  "techStack": [
    "Salesforce",
    "Slack",
    "Gmail",
    "Google Sheets"
  ],
  "trigger": {
    "type": "Schedule",
    "condition": "Always"
  },
  "currentFriction": {
    "hoursPerWeek": "15",
    "teamSize": "6-20"
  }
}`;

const dataStr = '{"logic": "// Only minimal block logic...","workflow": {"input": "{\\"sheetName\\": {\\"type\\": \\"string\\", \\"description\\": \\"Name of the sheet within the Google Spreadsheet for lead data.\\"}, \\"orgTimezone\\": {\\"type\\": \\"string\\", \\"description\\": \\"Organization''s timezone for scheduling (e.g., ''America/New_York'').\\"}, \\"teamMembers\\": {\\"type\\": \\"array\\", \\"items\\": {\\"type\\": \\"object\\", \\"properties\\": {\\"id\\": {\\"type\\": \\"string\\"}, \\"email\\": {\\"type\\": \\"string\\"}}}, \\"description\\": \\"List of team members for round-robin assignment, each with id and email.\\"}, \\"spreadsheetId\\": {\\"type\\": \\"string\\", \\"description\\": \\"ID of the Google Sheet for lead tracking and status logs.\\"}, \\"opsSlackChannel\\": {\\"type\\": \\"string\\", \\"description\\": \\"Slack channel ID for operational alerts and escalations.\\"}, \\"statusSheetName\\": {\\"type\\": \\"string\\", \\"description\\": \\"Name of the sheet within the Google Spreadsheet for workflow status logs.\\"}}", "output": "Updated Google Sheets and scheduled MS Teams meetings.", "process": "Automated lead data extraction, assignment logic, and follow-up tracking.", "description": "End-to-end sales lead processing, assignment, and meeting scheduling pipeline."}}';

const data = JSON.parse(dataStr);
console.log("Extracted title:");
console.log(extractWorkflowTitle(promptStr, data as any));
