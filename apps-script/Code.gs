const SHEET_ATTENDANCE = "Attendance";
const SHEET_AUDIT = "AttendanceAudit";
const IDEMPOTENCY_PREFIX = "outbox:";

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lock.waitLock(30000);
    lockAcquired = true;

    const request = parseRequest_(e);
    const events = Array.isArray(request.events) ? request.events : [];

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const attendanceSheet = getOrCreateSheet_(spreadsheet, SHEET_ATTENDANCE, [
      "id",
      "shiftId",
      "userId",
      "status",
      "markedAt",
      "version",
      "clientUpdatedAt",
      "serverUpdatedAt",
    ]);
    const auditSheet = getOrCreateSheet_(spreadsheet, SHEET_AUDIT, [
      "eventId",
      "recordId",
      "action",
      "reason",
      "createdAt",
    ]);

    const existingRecords = readAttendanceIndex_(attendanceSheet);
    const properties = PropertiesService.getScriptProperties();
    const result = processEvents_(events, existingRecords, properties);

    writeAttendanceUpdates_(attendanceSheet, result.rowsToUpdate);
    appendRows_(attendanceSheet, result.rowsToAppend);
    appendRows_(auditSheet, result.auditRows);

    return json_({
      ackedIds: result.ackedIds,
      records: result.records,
      conflicts: result.conflicts,
    });
  } catch (error) {
    return json_({
      error: String(error && error.message ? error.message : error),
    });
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body");
  }

  return JSON.parse(e.postData.contents);
}

function processEvents_(events, existingRecords, properties) {
  const result = {
    ackedIds: [],
    records: [],
    conflicts: [],
    auditRows: [],
    rowsToAppend: [],
    rowsToUpdate: [],
  };

  events.forEach(function (event) {
    if (!isValidEvent_(event)) {
      return;
    }

    const eventKey = IDEMPOTENCY_PREFIX + event.id;
    const payload = event.payload;

    if (properties.getProperty(eventKey)) {
      const duplicateCurrent = existingRecords.get(payload.id);

      result.ackedIds.push(event.id);

      if (duplicateCurrent) {
        result.records.push({
          id: payload.id,
          version: duplicateCurrent.version,
          syncStatus: "synced",
        });
      }

      return;
    }

    const current = existingRecords.get(payload.id);
    const serverNow = new Date().toISOString();

    if (current && isRemoteNewer_(current.clientUpdatedAt, payload.updatedAt)) {
      result.ackedIds.push(event.id);
      result.conflicts.push({ id: payload.id, reason: "REMOTE_RECORD_IS_NEWER" });
      result.records.push({ id: payload.id, version: current.version, syncStatus: "conflict" });
      result.auditRows.push([event.id, payload.id, "CONFLICT", "REMOTE_RECORD_IS_NEWER", serverNow]);
      properties.setProperty(eventKey, "1");
      return;
    }

    const nextVersion = current ? current.version + 1 : 1;
    const row = [
      payload.id,
      payload.shiftId,
      payload.userId,
      payload.status,
      payload.markedAt,
      nextVersion,
      payload.updatedAt,
      serverNow,
    ];

    if (current) {
      result.rowsToUpdate.push({ rowNumber: current.rowNumber, row: row });
    } else {
      result.rowsToAppend.push(row);
    }

    result.ackedIds.push(event.id);
    result.records.push({ id: payload.id, version: nextVersion, syncStatus: "synced" });
    result.auditRows.push([event.id, payload.id, current ? "UPDATED" : "CREATED", "", serverNow]);
    properties.setProperty(eventKey, "1");
  });

  return result;
}

function isValidEvent_(event) {
  return Boolean(
    event &&
      event.id &&
      event.type === "ATTENDANCE_MARKED" &&
      event.payload &&
      event.payload.id &&
      event.payload.shiftId &&
      event.payload.userId &&
      event.payload.status &&
      event.payload.markedAt &&
      event.payload.updatedAt,
  );
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function readAttendanceIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const index = new Map();

  if (lastRow < 2 || lastColumn < 1) {
    return index;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  values.forEach(function (row, indexOffset) {
    const id = String(row[0] || "");

    if (!id) {
      return;
    }

    index.set(id, {
      rowNumber: indexOffset + 2,
      id: id,
      version: Number(row[5] || 0),
      clientUpdatedAt: String(row[6] || ""),
    });
  });

  return index;
}

function writeAttendanceUpdates_(sheet, rowsToUpdate) {
  rowsToUpdate.forEach(function (item) {
    sheet.getRange(item.rowNumber, 1, 1, item.row.length).setValues([item.row]);
  });
}

function appendRows_(sheet, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function isRemoteNewer_(remoteUpdatedAt, localUpdatedAt) {
  if (!remoteUpdatedAt || !localUpdatedAt) {
    return false;
  }

  return new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAt).getTime();
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
