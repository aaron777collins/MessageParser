document.addEventListener('DOMContentLoaded', () => {
    M.AutoInit();
    loadFormDataFromURL();
});

let parseOptions = [];

function addParseOption() {
    const optionContainer = document.createElement('div');
    optionContainer.className = 'parse-option card-panel';
    optionContainer.innerHTML = `
        <div class="row">
            <div class="input-field col s6">
                <input type="text" class="parseBefore parseOption">
                <label>Text Occurring Before</label>
            </div>
            <div class="input-field col s6">
                <input type="text" class="parseAfter parseOption">
                <label>Text Occurring After</label>
            </div>
            <div class="col s12">
                <button class="btn dark-maroon remove-btn" type="button" onclick="removeParseOption(this)">Remove</button>
            </div>
        </div>
    `;
    document.getElementById('parseOptions').appendChild(optionContainer);
    M.updateTextFields(); // To reinitialize the labels correctly
}

function removeParseOption(button) {
    button.parentNode.parentNode.parentNode.remove();
}

function parseXLSX() {
    const fileInput = document.getElementById('fileInput');
    const columnName = document.getElementById('columnInput').value || '_source.message';
    if (!fileInput.files.length) {
        Toastify({
            text: 'Please select an XLSX file to parse',
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center',
            backgroundColor: '#ff416c',
        }).showToast();
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const parsedData = parseXLSXData(csvData, columnName);
        displayResults(parsedData);
        saveFormDataInURL();
    };
    reader.readAsArrayBuffer(file);
}

function parseXLSXData(sheetData, columnName) {
    const headers = sheetData[0];
    var columnIndex = -1
    if (headers.length == 1 && headers.indexOf(columnName) == -1) {
        // If only one column is present, then it is the data column
        columnIndex = 0;
        // Notify the user that only one column is present so the column name
        // is being ignored
        Toastify({
            text: 'Can\'t find the column name in the XLSX file. Using the only column present, ' + "'" + headers[0] + "'",
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center', // darker yellow
            backgroundColor: '#ffaa00',
        }).showToast();
        // Update the form field to reflect the column name being used
        document.getElementById('columnInput').value = headers[0];
        M.updateTextFields();
    } else {
        columnIndex = headers.length > 1 ? headers.indexOf(columnName) : 0;
    }
    if (columnIndex === -1) {
        console.log('Column not found in XLSX. Headers:', headers);
        Toastify({
            text: 'Column not found in XLSX. Please check the column name and try again. Column Names: ' + headers.join(', '),
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center',
            backgroundColor: '#ff416c',
        }).showToast();
        return [];
    }

    // Update Parse Options
    parseOptions = [];
    const parseOptionElements = document.querySelectorAll('.parse-option');
    parseOptionElements.forEach(option => {
        if (option.querySelector('.parseBefore').value || option.querySelector('.parseAfter').value) {
            parseOptions.push(option);
        }
    });

    const results = [];
    for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        let cellValue = row[columnIndex];
        if (cellValue !== undefined) {
            cellValue = cellValue.toString().trim();
            parseOptions.forEach(option => {
                const before = option.querySelector('.parseBefore').value;
                const after = option.querySelector('.parseAfter').value;
                cellValue = parseText(cellValue, before, after);
            });
            results.push(cellValue);
        }
    }
    Toastify({
        text: 'Parsed ' + results.length + ' rows successfully',
        duration: 3000,
        close: true,
        gravity: 'top',
        position: 'center', // green
        backgroundColor: '#00b09b',
    }).showToast();
    return results;
}

function parseText(text, before, after) {
    let result = text;
    if (before) {
        const parts = result.split(before);
        result = parts.length > 1 ? parts[1] : result;
    }
    if (after) {
        const parts = result.split(after);
        result = parts.length > 1 ? parts[0] : result;
    }
    return result.trim();
}

function displayResults(results) {
    const resultContainer = document.getElementById('results');
    resultContainer.innerText = results.join('\n');
}

function exportResultsAsXLSX() {
    const results = document.getElementById('results').innerText.split('\n');
    const worksheet = XLSX.utils.aoa_to_sheet([['Results'], ...results.map(result => [result])]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    XLSX.writeFile(workbook, 'results.xlsx');
}

function copyResultsToClipboard(separator = '\n') {
    const results = document.getElementById('results').innerText.split('\n').join(separator);
    navigator.clipboard.writeText(results).then(() => {
        console.log('Results copied to clipboard');
        Toastify({
            text: 'Results copied to clipboard',
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center', // green
            backgroundColor: '#00b09b',
        }).showToast();
    }, (err) => {
        console.error('Failed to copy results to clipboard:', err);
        Toastify({
            text: 'Failed to copy results to clipboard. Please try again.',
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center',
            backgroundColor: '#ff416c',
        }).showToast();
    });
}

function saveFormDataInURL() {
    const columnInput = document.getElementById('columnInput').value;
    const parseOptions = document.querySelectorAll('.parse-option');
    let queryParams = [];

    if (columnInput) {
        queryParams.push(`column=${encodeURIComponent(columnInput)}`);
    }
    parseOptions.forEach((option, index) => {
        const before = option.querySelector('.parseBefore').value;
        const after = option.querySelector('.parseAfter').value;
        if (before) {
            queryParams.push(`before${index}=${encodeURIComponent(before)}`);
        }
        if (after) {
            queryParams.push(`after${index}=${encodeURIComponent(after)}`);
        }
    });

    const url = new URL(window.location);
    url.search = queryParams.join('&');
    window.history.replaceState(null, '', url);
}

function loadFormDataFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const columnInput = urlParams.get('column');
    if (columnInput) {
        document.getElementById('columnInput').value = columnInput;
    }

    let index = 0;
    while (urlParams.has(`before${index}`) || urlParams.has(`after${index}`)) {
        addParseOption();
        const parseOptions = document.querySelectorAll('.parse-option');
        const option = parseOptions[parseOptions.length - 1];
        option.querySelector('.parseBefore').value = urlParams.get(`before${index}`) || '';
        option.querySelector('.parseAfter').value = urlParams.get(`after${index}`) || '';
        index++;
    }
    if (index === 0) {
        addParseOption();
    }

    M.updateTextFields();
}
