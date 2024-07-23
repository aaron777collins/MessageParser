document.addEventListener('DOMContentLoaded', () => {
    M.AutoInit();
    loadFormDataFromURL();
    initSortable();
});


let parseOptions = [];

function initSortable() {
    const parseOptionsContainer = document.getElementById('parseOptions');
    new Sortable(parseOptionsContainer, {
        animation: 150,
        onEnd: () => {
            saveFormDataInURL();
        }
    });
}

function addParseOption() {
    const optionContainer = document.createElement('div');
    optionContainer.className = 'parse-option card-panel';
    // Detect edit event and save form data in URL
    optionContainer.innerHTML = `
        <div class="row">
            <div class="input-field col s6">
                <input type="text" class="parseBefore parseOption" oninput="onEditDebounce()(saveFormDataInURL)">
                <label>Text Occurring Before</label>
            </div>
            <div class="input-field col s6">
                <input type="text" class="parseAfter parseOption" oninput="onEditDebounce()(saveFormDataInURL)">
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

// on edit debounce
function onEditDebounce() {
    const debounceTime = 500;
    let timeout;
    return function (callback) {
        clearTimeout(timeout);
        timeout = setTimeout(callback, debounceTime);
    };
}

function removeParseOption(button) {
    button.parentNode.parentNode.parentNode.remove();
    saveFormDataInURL();
}

// Returns promise that resolves after given time
function parseXLSX() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
        Toastify({
            text: 'Please select an XLSX file to parse',
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center',
            backgroundColor: '#ff416c',
        }).showToast();
        return new Promise((resolve, reject) => reject('No file selected'));
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        // If dropdown isn't populated, populate it with the first row of the XLSX
        if (document.getElementById('columnInput').querySelectorAll('option').length <= 1) {
            populateColumnDropdown(csvData[0]);
            // set selected column to _source.message if it exists
            if (csvData[0].includes('_source.message')) {
                document.getElementById('columnInput').value = '_source.message';
                // Update drop down to show selected value
                M.FormSelect.init(document.getElementById('columnInput'));
                saveFormDataInURL();
            }
        }
        const parsedData = parseXLSXData(csvData);
        displayResults(parsedData);
    };
    reader.readAsArrayBuffer(file);
    // Return a promise that resolves after parsing the XLSX and waiting 100ms
    return new Promise((resolve, reject) => setTimeout(resolve, 100));
}

function populateColumnDropdown(headers) {
    const columnInput = document.getElementById('columnInput');
    columnInput.innerHTML = '<option value="" disabled selected>Choose your column</option>';
    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.text = header;
        columnInput.appendChild(option);
    });
    M.FormSelect.init(columnInput); // Reinitialize Materialize select
}

function populateGroupColumnDropdown() {
    const groupColumnInput = document.getElementById('groupColumnInput');
    groupColumnInput.innerHTML = '<option value="" disabled selected>Choose column to group by</option>';
    var headers = ['Value', 'Count'];
    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.text = header;
        groupColumnInput.appendChild(option);
    });
    M.FormSelect.init(groupColumnInput);
}

function parseXLSXData(sheetData) {
    const columnName = document.getElementById('columnInput').value || '_source.message';
    const columnIndex = sheetData[0].indexOf(columnName);
    if (columnIndex === -1) {
        Toastify({
            text: 'Column not found in XLSX. Please check the column name and try again.',
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
        position: 'center',
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

function groupAndCountResultsWrapper() {
    // first call parseXLSX to get the data (promise)
    parseXLSX().then(() => {
        // then call groupAndCountResults
        groupAndCountResults();
    });
}

function groupAndCountResultsWrapperOnUpdate() {
    // Calls groupAndCountResultsWrapper when the column dropdown is updated
    // but checks if the sort options and sort order have been selected first
    const sortOptions = document.getElementById('sortOptions');
    if (sortOptions.style.display === 'none') {
        return;
    }
    // Checks drop downs
    const sortColumn = document.getElementById('sortColumnInput').value;
    const sortOrder = document.getElementById('sortOrderInput').value;
    if (sortColumn && sortOrder) {
        groupAndCountResultsWrapper();
    }
}

function groupAndCountResults() {

    const sortOptions = document.getElementById('sortOptions');

    if (sortOptions.style.display === 'none') {
        sortOptions.style.display = 'block';
        return;
    }

    const sortColumn = document.getElementById('sortColumnInput').value;
    const sortOrder = document.getElementById('sortOrderInput').value;

    if (!sortColumn) {
        Toastify({
            text: 'Please select a column to sort by',
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center',
            backgroundColor: '#ff416c',
        }).showToast();
        return;
    }

    if (!sortOrder) {
        Toastify({
            text: 'Please select a sort order',
            duration: 3000,
            close: true,
            gravity: 'top',
            position: 'center',
            backgroundColor: '#ff416c',
        }).showToast();
        return;
    }

    const results = document.getElementById('results').innerText.split('\n');
    const countMap = results.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});

    const groupedResults = Object.entries(countMap).map(([value, count]) => ({ value, count }));
    groupedResults.sort((a, b) => {
        if (sortOrder === 'ascending') {
            return a[sortColumn] > b[sortColumn] ? 1 : -1;
        } else {
            return a[sortColumn] < b[sortColumn] ? 1 : -1;
        }
    });

    displayGroupedResults(groupedResults);
}

function displayGroupedResults(groupedResults) {
    const resultContainer = document.getElementById('results');
    resultContainer.innerText = groupedResults.map(result => `${result.value}\t${result.count}`).join('\n');
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
