function bindAll(obj){
    for (const key in obj) {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        }
    }
}

class UserTable {

    constructor() {
        this.userElementName = 'element';
        this.tableBody = document.getElementById('table-body');
        this.tableHeading = document.getElementById('table-head');
        this.search = document.getElementById('search');
        this.dropdown = document.getElementById('dropdown');
        bindAll(this);
        this.headings = this.getHeadings(this.tableHeading);
        this.setDropDownOptions(this.headings, this.dropdown);
        this.originalUsers = this.getOriginalUsers(this.tableBody, this.headings, this.userElementName);
        this.users = [...this.originalUsers];

        this.search.addEventListener('keydown', () => {
            this.searchUsers(this.search.value, this.originalUsers, this.dropdown, this.tableBody, this.userElementName);
        });
    }

    getOriginalUsers(tableBody, headings, userElementName){
        const rows = Array.from(tableBody.children);
        return rows.map(tableRow => {
            const cells = Array.from(tableRow.children);
            const user = cells.reduce((user, cell, index) => {
                const cellHeading = headings[index];
                user[cellHeading] = cell.innerText;
                return user;
            }, {});
            user[userElementName] = tableRow;
            return user;
        });
    }

    setDropDownOptions(headings, dropdown){            
        headings.forEach((heading, index) => {
            const option = document.createElement("option");
            option.innerText = heading;
            option.value = index + 1;
            dropdown.appendChild(option);
        });
    }

    getHeadings(tableHeading){
        const children = Array.from(tableHeading.children);
        return children.map(child => child.innerText);
    }

    searchUsers(query, originalUsers, dropdown, tableBody, userElementName){
        if(query === ''){
            const newUsers = [...originalUsers];
            this.rerenderUsers(newUsers, tableBody, userElementName);
            return;
        }
        const searchIndex = dropdown.selectedIndex - 1;
        let results = null;
        if(searchIndex >= 0){
            const key = this.headings[searchIndex];
            results = fuzzysort.go(query, originalUsers, {key});
        }
        else{
            const keys = this.headings;
            results = fuzzysort.go(query, originalUsers, {keys});
        }
        const users = results.map(result => result.obj);
        this.rerenderUsers(users, tableBody, userElementName);
    }

    // sortUsers(fieldName, isReverse) {
    //     let sortedList = this.users.sort((user1, user2) => {
    //         const field1 = user1[fieldName];
    //         const field2 = user2[fieldName];
    //         return field1.localeCompare(field2);
    //     });
    //     if (isReverse) {
    //         sortedList = sortedList.reverse();
    //     }
    //     this.users = sortedList;
    //     rerenderUsers();
    // }

    rerenderUsers(users, tableBody, userElementName){
        this.users = users;
        while (tableBody.firstChild) {
            tableBody.removeChild(tableBody.firstChild);
        }
        users.forEach((user) => {
            const userElement = user[userElementName];
            tableBody.appendChild(userElement);
        });
    }
}

document.addEventListener("DOMContentLoaded", (event) => {
    const table = new UserTable();
});