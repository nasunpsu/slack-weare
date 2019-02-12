/**
 * Binds all functions to always have 'this' to be the object itself
 * @param {any} obj Object to bind all methods to
 */
function bindAll(obj){
    for (const key in obj) {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        }
    }
}

class UserTable {

    constructor() {
        bindAll(this);

        this.userElementName = 'element';
        // Current signed in user must be passed from front end
        if(!window.sessionUser){
            throw Error('Session user not defined');
        }
        this.sessionUser = window.sessionUser;
        delete window.sessionUser;

        this.tableBody = document.getElementById('table-body');
        this.tableHeading = document.getElementById('table-head');
        this.search = document.getElementById('search');
        this.dropdown = document.getElementById('dropdown');
        this.locationCheck = document.getElementById('locationCheck');
        this.majorCheck = document.getElementById('majorCheck');
        this.headings = this.getHeadings(this.tableHeading);

        this.setDropDownOptions(this.headings, this.dropdown);
        this.originalUsers = this.getOriginalUsers(this.tableBody, this.headings, this.userElementName);
        this.users = [...this.originalUsers];

        this.search.addEventListener('keyup', () => {
            this.searchUsers(this.search.value, this.originalUsers, this.dropdown, this.tableBody, this.userElementName);
        });

        const onCheck = () => {
            const isLocation = this.locationCheck.checked; 
            const isMajor = this.majorCheck.checked; 
            this.filterUsers(isLocation, isMajor, this.tableBody, this.userElementName, this.sessionUser);
        };

        this.locationCheck.addEventListener('change', onCheck);
        this.majorCheck.addEventListener('change', onCheck);
    }

    filterUsers(isLocation, isMajor, tableBody, userElementName, sessionUser){
        if(!sessionUser.local_area){
            throw new Error('No local_area defined')
        }
        const newUsers = this.originalUsers.filter(user => {
            if(isLocation && sessionUser.local_area !== user.Location){
                return false;
            }
            if(isMajor && sessionUser.major !== user.Major){
                return false;
            }
            return true;
        });
        this.rerenderUsers(newUsers, tableBody, userElementName);
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

document.addEventListener('DOMContentLoaded', () => {
    //Activate the sortable table using semantic UI
    $('.sortable').tablesort();
    new UserTable();
});