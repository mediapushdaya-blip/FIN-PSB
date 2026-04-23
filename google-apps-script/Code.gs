/**
 * FINTRACK - GOOGLE APPS SCRIPT BACKEND
 * 
 * Cara Penggunaan:
 * 1. Buka Google Sheets baru (sheet.new)
 * 2. Klik Ekstensi > Apps Script
 * 3. Hapus kode yang ada, paste semua kode ini
 * 4. Klik Simpan (ikon disket)
 * 5. Klik Terapkan (Deploy) > Deployment Baru
 * 6. Pilih jenis: Aplikasi Web (Web App)
 * 7. Akses: "Siapa saja" (Anyone)
 * 8. Klik Terapkan, berikan izin akses
 * 9. Copy "URL Aplikasi Web" dan masukkan ke VITE_GAS_URL di .env
 */

const SHEET_NAME = "Transactions";

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_NAME)) {
    const sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["id", "tanggal", "deskripsi", "kategori", "nominal", "status"]);
  }
}

function doGet(e) {
  // Jika diakses via browser langsung (opsional untuk UI embedded)
  if (!e || !e.parameter || !e.parameter.api) {
    return ContentService.createTextOutput("FinTrack API is running. Use ?api=true to fetch data.");
  }
  
  // REST API GET
  try {
    const data = getTransactions();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    // Parsing text/plain untuk menghindari masalah CORS preflight
    const body = JSON.parse(e.postData.contents);
    
    let result;
    if (body.action === 'edit') {
      result = editTransaction(body);
    } else if (body.action === 'delete') {
      result = deleteTransaction(body);
    } else {
      result = addTransaction(body);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- FUNGSI UTAMA ---

function getTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Hanya header
  
  const headers = data[0];
  const rows = data.slice(1);
  const idColIndex = headers.indexOf('id');
  
  const result = rows.map((row, index) => {
    let obj = {};
    headers.forEach((header, i) => {
      // Format tanggal jika berupa objek Date
      if (header === 'tanggal' && row[i] instanceof Date) {
        // adjust to local timezone string
        const d = row[i];
        const localDate = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        obj[header] = localDate;
      } else {
        obj[header] = row[i];
      }
    });

    // Auto-backfill missing IDs to allow legacy data compatibility
    if (idColIndex !== -1 && !obj.id) {
       const newId = Utilities.getUuid();
       obj.id = newId;
       sheet.getRange(index + 2, idColIndex + 1).setValue(newId);
    }
    
    return obj;
  });
  
  // Urutkan dari yang terbaru
  return result.reverse();
}

function addTransaction(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(SHEET_NAME);
  }
  
  const headers = sheet.getDataRange().getValues()[0];
  const id = Utilities.getUuid();
  
  const rowData = headers.map(header => {
    if (header === 'id') return id;
    if (header === 'tanggal') return data.tanggal || new Date().toISOString().split('T')[0];
    if (data[header] !== undefined) return data[header];
    return "";
  });
  
  sheet.appendRow(rowData);
  
  return { success: true, id: id };
}

function editTransaction(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    return { success: false, error: 'Sheet tidak ditemukan' };
  }
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');
  
  if (idColIndex === -1) return { success: false, error: 'Kolom ID tidak ditemukan di sheet' };

  let rowIndex = -1;
  // Cari baris berdasarkan ID
  for (let i = 1; i < values.length; i++) {
    if (values[i][idColIndex] === data.id) {
      rowIndex = i + 1; // +1 karena getRange menggunakan 1-based indexing
      break;
    }
  }
  
  if (rowIndex === -1) {
    return { success: false, error: 'Data tidak ditemukan' };
  }
  
  // Jika rekening atau field lain ada di array tapi tidak di sheet header, kita bypass (atau tambahkan header jika mau dinamis).
  // Untuk amannya, kita update column by column sesuai header
  headers.forEach((header, colIndex) => {
    if (header !== 'id' && data[header] !== undefined) {
       sheet.getRange(rowIndex, colIndex + 1).setValue(data[header]);
    }
  });
  
  return { success: true, id: data.id };
}

function deleteTransaction(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) return { success: false, error: 'Sheet tidak ditemukan' };
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idColIndex = headers.indexOf('id');
  
  if (idColIndex === -1) return { success: false, error: 'Kolom ID tidak ditemukan di sheet' };

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idColIndex] === data.id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex);
    return { success: true };
  } else {
    return { success: false, error: 'Data tidak ditemukan' };
  }
}

// --- FUNGSI UNTUK EMBEDDED HTML (Jika di-deploy sebagai Add-on) ---
function getTransactionsApi() {
  return JSON.stringify(getTransactions());
}

function addTransactionApi(data) {
  return JSON.stringify(addTransaction(data));
}

function editTransactionApi(data) {
  return JSON.stringify(editTransaction(data));
}

function deleteTransactionApi(data) {
  return JSON.stringify(deleteTransaction(data));
}
