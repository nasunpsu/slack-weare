const getBody = () => document.getElementById('table-body');

const getHead = () => document.getElementById('table-head');

const getHeadings = () => {
    const tableHead = getHead();
    return Array.from(tableHead.children).map(child => child.innerText);
}

const getUsers = () => {
    const headings = getHeadings();
    const tableBody = getBody();
    return Array.from(tableBody.children).map(tableRow => {
        const obj = Array.from(tableRow.children).reduce((obj, cell, index) => {
            const cellHeading = headings[index];
            obj[cellHeading] = cell.innerText;
            return obj;
        }, {});
        obj['element'] = tableRow;
        return obj;
    });
}

const sortUsers = (fieldName, isReverse) => {
    let sortedList = getUsers().sort((user1, user2) => {
        const field1 = user1[fieldName];
        const field2 = user2[fieldName];
        return field1.localeCompare(field2);
    }); 
    if(isReverse){
        sortedList = sortedList.reverse();
    }
    rerenderUsers(sortedList);
}

const rerenderUsers = (userList) => {
    const tableBody = getBody();
    while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
    }
    userList.forEach((tableRow) => {
        tableBody.appendChild(tableRow['element']);
    });
}