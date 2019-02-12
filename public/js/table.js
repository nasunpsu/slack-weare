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


        const onCheckOrSearch = () => {
            const isLocation = this.locationCheck.checked; 
            const isMajor = this.majorCheck.checked; 
            const query = this.search.value;
            this.searchAndFilter(isLocation, isMajor, this.sessionUser, query, this.originalUsers, this.dropdown, this.tableBody, this.userElementName);
        };

        this.locationCheck.addEventListener('change', onCheckOrSearch);
        this.majorCheck.addEventListener('change', onCheckOrSearch);
        this.search.addEventListener('keyup', onCheckOrSearch);
    }

    filterUsers(isLocation, isMajor, users, sessionUser){
        if(!sessionUser.local_area){
            throw new Error('No local_area defined')
        }
        return users.filter(user => {
            if(isLocation && sessionUser.local_area !== user.Location){
                return false;
            }
            if(isMajor && sessionUser.major !== user.Major){
                return false;
            }
            return true;
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

    searchUsers(query, originalUsers, dropdown){
        this.resetSorting();
        if(query === ''){
            return originalUsers
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
        return results.map(result => result.obj);
    }

    searchAndFilter(isLocation, isMajor, sessionUser, query, originalUsers, dropdown, tableBody, userElementName){
        let users = this.searchUsers(query, originalUsers, dropdown);
        users = this.filterUsers(isLocation, isMajor, users, sessionUser);
        this.rerenderUsers(users, tableBody, userElementName);
    }

    resetSorting(){
        $('.sorted').removeClass('sorted');
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