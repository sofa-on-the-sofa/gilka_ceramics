// Google Apps Script для автоматичної синхронізації з сайтом "Гілка"
// Інструкція: Таблиця -> Розширення -> Apps Script -> Вставити цей код -> Зберегти

const GITHUB_REPO = 'sofa-on-the-sofa/gilka_ceramics';
const WORKFLOW_FILE = 'sync.yml';

// Токен GitHub (вже скопійовано в буфер обміну, вставити між лапками)
const GITHUB_TOKEN = 'ВСТАВ_СЮДИ_ТОКЕН';

// Меню вгорі таблиці
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏺 Сайт')
    .addItem('⚡ Оновити сайт зараз', 'triggerGitHubSync')
    .addItem('⚙️ Налаштувати автосинк (1 раз)', 'setupTrigger')
    .addToUi();
}

// Автоматичне спрацювання при будь-якій зміні в таблиці
function onCatalogEdit(e) {
  const range = e ? e.range : null;
  const sheet = range ? range.getSheet() : SpreadsheetApp.getActiveSheet();
  
  // Реагуємо тільки на зміни в аркуші "Каталог"
  if (sheet.getName() !== 'Каталог') return;
  
  // Ігноруємо шапку (рядок 1)
  if (range && range.getRow() === 1) return;

  // Автопроставляння дати при зміні статусу на продано
  const numCols = sheet.getLastColumn();
  if (range && numCols > 0) {
    const headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];
    const statusCol = headers.findIndex(h => {
      const name = h.toString().trim().toLowerCase();
      return name === 'наявність' || name === 'статус';
    }) + 1;
    const dateCol = headers.findIndex(h => h.toString().trim().toLowerCase() === 'дата продажу') + 1;

    if (statusCol > 0 && range.getColumn() === statusCol) {
      const row = range.getRow();
      const val = range.getValue();
      const strVal = (val !== null && val !== undefined ? val.toString() : '').trim().toLowerCase();
      const isSold = val === false || ['false', '-', 'продано', 'sold', '0', 'ні', 'no'].includes(strVal);

      if (dateCol > 0) {
        const dateCell = sheet.getRange(row, dateCol);
        if (isSold) {
          if (!dateCell.getValue()) {
            const today = Utilities.formatDate(new Date(), 'Europe/Kyiv', 'dd.MM.yyyy');
            dateCell.setValue(today);
          }
        } else {
          // Якщо статус повернули в наявність (галочка стоїть / + тощо) — прибираємо дату продажу
          dateCell.clearContent();
        }
      }
    }
  }

  // Захист від частих викликів: не частіше разу на 10 секунд
  const cache = CacheService.getScriptCache();
  if (cache.get('sync_lock')) return;
  cache.put('sync_lock', '1', 10);

  triggerGitHubSync();
}

// Запит до GitHub Actions API
function triggerGitHubSync() {
  if (!GITHUB_TOKEN || GITHUB_TOKEN === 'ВСТАВ_СЮДИ_ТОКЕН') {
    SpreadsheetApp.getUi().alert('Потрібно вказати GITHUB_TOKEN у скрипті.');
    return;
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + GITHUB_TOKEN,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      Logger.log('GitHub Sync запущено успішно (HTTP ' + code + ')');
    } else {
      Logger.log('Помилка: HTTP ' + code + ' — ' + response.getContentText());
    }
  } catch (err) {
    Logger.log('Помилка запиту: ' + err.toString());
  }
}

// Створення встановлюваного тригера
function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  ScriptApp.newTrigger('onCatalogEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert('✅ Автосинк успішно увімкнено! Тепер кожна зміна в "Каталозі" автоматично надсилає сигнал на сайт.');
}