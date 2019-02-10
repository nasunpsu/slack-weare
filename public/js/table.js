const getHeadings = () => {
    const tableHead = document.getElementById('table-head');
    return Array.from(tableHead.children).map(child => child.innerText);
}

const getUsers = () => {
    const headings = getHeadings();
    const tableBody = document.getElementById('table-body');
    return Array.from(tableBody.children).map(tableRow => {
        return Array.from(tableRow.children).reduce((obj, cell, index) => {
            const cellHeading = headings[index];
            obj[cellHeading] = cell.innerText;
            return obj;
        }, {});
    });
}