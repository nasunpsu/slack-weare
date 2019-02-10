class UserTable {

    constructor() {
        this.userElementName = 'element';
        this.tableBody = document.getElementById('table-body');
        this.tableHeading = document.getElementById('table-head');
        this.search = document.getElementById('search');
        this.headings = (() => {
            const children = Array.from(this.tableHeading.children);
            return children.map(child => child.innerText);
        })();
        this.users = (() => {
            const rows = Array.from(this.tableBody.children);
            return rows.map(tableRow => {
                const cells = Array.from(tableRow.children); 
                const user = cells.reduce((user, cell, index) => {
                    const cellHeading = this.headings[index];
                    user[cellHeading] = cell.innerText;
                    return user;
                }, {});
                user[this.userElementName] = tableRow;
                return user;
            });
        })();
        this.originalUsers = [...this.users];
        this.sortUsers = this.sortUsers.bind(this);
        this.rerenderUsers = this.rerenderUsers.bind(this);
        this.searchUsers = this.searchUsers.bind(this);

        this.search.addEventListener('keydown', () => this.searchUsers(this.search.value));
    }

    searchUsers(query){
        if(query === ''){
            this.users = [...this.originalUsers];
            this.rerenderUsers();
            return;
        }
        const results = fuzzysort.go(query, this.originalUsers, {key: this.headings[0]});
        this.users = results.map(result => result.obj);
        this.rerenderUsers();
        const results2 = fuzzysort.go(query, this.users, {keys: this.headings});
        console.log(results2);
        // const elements = results.map(result => result.obj.element);
    }

    sortUsers(fieldName, isReverse) {
        let sortedList = this.users.sort((user1, user2) => {
            const field1 = user1[fieldName];
            const field2 = user2[fieldName];
            return field1.localeCompare(field2);
        });
        if (isReverse) {
            sortedList = sortedList.reverse();
        }
        this.users = sortedList;
        rerenderUsers();
    }

    rerenderUsers() {
        while (this.tableBody.firstChild) {
            this.tableBody.removeChild(this.tableBody.firstChild);
        }
        this.users.forEach((user) => {
            const userElement = user[this.userElementName];
            this.tableBody.appendChild(userElement);
        });
    }
}
document.addEventListener("DOMContentLoaded", (event) => {
    const table = new UserTable();
});