/**
 * Binds all functions to always have 'this' to be the object itself
 * @param {any} obj Object to bind all methods to
 */

$('.search-by-dropdown .ui.dropdown')
.dropdown({
  clearable: true,
  placeholder: 'Search By'
});

$('.sort-dropdown .ui.dropdown')
.dropdown({
  clearable: true,
  placeholder: 'Sort By'
});
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

        this.resultsPerPage = 10;
        this.userElementName = 'element';
        this.checkBoxValues = ['local_area', 'major', 'profession', 'military', 'parental', 'past_classes'];

        // Current signed in user must be passed from front end
        if(!window.sessionUser){
            throw Error('Session user not defined');
        }
        this.sessionUser = window.sessionUser;
        delete window.sessionUser;

        if(!window.tableUsers){
            throw Error('Table users were not defined');
        }
        this.users = window.tableUsers;
        delete window.tableUsers;
        this.tableBody = document.getElementById('table-body');
        this.tableHeading = document.getElementById('table-head');
        this.search = document.getElementById('search');
        this.searchDropdown = document.getElementById('searchby-dropdown');
        this.checkboxes = $('#checkboxes').find('input');
        this.nextPage = document.getElementById('nextPage');
        this.previousPage = document.getElementById('previousPage');
        this.pageContainer = document.getElementById('page-container');

        this.headings = this.getHeadings(this.tableHeading);
        this.users = this.getUserElements(this.tableBody, this.userElementName, this.users);
        this.sortBy = null;
        this.headingElements = $(this.tableHeading).find('th');
        this.headingElements.click(event => {
            if(!!this.search.value){
                return;
            }
            const target = event.target;
            const index = [...target.parentElement.children].indexOf(target);
            if(this.sortBy === index){
                updateResults();
                return;
            }
            updateResults(index);
        });

        this.setDropDownOptions(this.headings, this.searchDropdown); 

        const updateResults = (sortIndex=-1) => {
            this.sortBy = sortIndex;
            const query = this.search.value;
            this.headingElements.removeClass('sort-heading');
            const sortReverse = false;
            let sortField;
            if(sortIndex === -1){
                sortField = '';
            }
            else{
                sortField = this.headings[sortIndex];
                if(!query){
                    $(this.tableHeading.children[sortIndex]).addClass('sort-heading');
                }
            }
            const {checkboxes, sessionUser, users, tableBody, searchDropdown, userElementName, resultsPerPage} = this;
            this.updateUsers(checkboxes, sessionUser, query, users, searchDropdown, tableBody, userElementName, sortField, sortReverse, resultsPerPage);
            this.numPages = Math.ceil(this.userResults.length / this.resultsPerPage);
            this.createPagination(this.numPages, this.previousPage, this.nextPage, this.pageContainer, this.userResults, this.resultsPerPage, this.tableBody, this.userElementName);
            this.changePage(this.userResults, 1, this.resultsPerPage, this.tableBody, this.userElementName, this.numPages);
        }

        this.checkboxes.change(updateResults);
        this.search.addEventListener('keyup', updateResults);
        this.searchDropdown.addEventListener('change', updateResults);
        this.nextPage.addEventListener('click', () => this.changePage(this.userResults, this.currentPage + 1, this.resultsPerPage, this.tableBody, this.userElementName, this.numPages));
        this.previousPage.addEventListener('click', () => this.changePage(this.userResults, this.currentPage - 1, this.resultsPerPage, this.tableBody, this.userElementName, this.numPages));
        updateResults();
    }

    createPagination(numPages, previousPage, nextPage, pageContainer, userResults, resultsPerPage, tableBody, userElementName){
        $('.page-number').remove();
        this.pages = Array(numPages).fill(0).map((_, index) => {;
            const page = previousPage.cloneNode();
            const num = index + 1
            page.innerText = num;
            page.className += ' page-number';
            page.addEventListener('click', () => {
                this.changePage(userResults, num, resultsPerPage, tableBody, userElementName, numPages);
            });
            pageContainer.insertBefore(page, nextPage);
            return page;
        });
    }

    updateUsers(checkboxes, sessionUser, query, originalUsers, searchDropdown, tableBody, userElementName, sortField, sortReverse, resultsPerPage){
        let users = this.sortUsers(originalUsers, sortField, sortReverse);
        users = this.searchUsers(query, originalUsers, searchDropdown);
        users = this.filterUsers(checkboxes, users, sessionUser);
        this.userResults = [...users];
    }

    filterUsers(checkboxes, users, sessionUser){
        const checked = Array.from(checkboxes).map(check => check.checked);
        const channelNames = sessionUser.channels.map(channel => channel.cname);
        return users.filter(user => {
            return checked.every((value, index) => {
                const key = this.checkBoxValues[index];
                //if the user doesn't have it, continue
                if(sessionUser[key] === undefined){
                    const checkbox = Array.from(checkboxes)[index];
                    //Name of channel
                    const text = checkbox.parentElement.innerText;
                    if(channelNames.includes(text)){
                        return !value || user.channelNames.includes(text);
                    }
                    return true;
                }
                //if there is no filter set, continue
                if(!value){
                    return true;
                }
                //if the filter is set but the two differ
                return !(value && sessionUser[key] !== user[key])
            });
        });
    }

    getUserElements(tableBody, userElementName, users){
        const rows = Array.from(tableBody.children);
        return rows.map((tableRow, index) => {
            let user = users[index];
            const cells = Array.from(tableRow.children);
            user = cells.reduce((obj, cell, index) => {
                const heading = this.headings[index];
                obj[heading] = cell.innerText;
                return obj;
            }, user);
            user[userElementName] = tableRow;
            return user;
        });
    }

    setDropDownOptions(headings, searchDropdown){            
        headings.forEach((heading, index) => {
            const option = document.createElement("option");
            option.innerText = heading;
            option.value = index + 1;
            searchDropdown.appendChild(option);
        });
    }

    getHeadings(tableHeading){
        const children = Array.from(tableHeading.children);
        return children.map(child => child.innerText);
    }

    searchUsers(query, users, dropdown){
        if(query === ''){
            return users
        }
        const searchIndex = dropdown.selectedIndex - 1;
        let results = null;
        if(searchIndex >= 0){
            const key = this.headings[searchIndex];
            results = fuzzysort.go(query, users, {key});
        }
        else{
            const keys = this.headings;
            results = fuzzysort.go(query, users, {keys});
        }
        return results.map(result => result.obj);
    }

    sortUsers(users, key, isReverse){
        if(key === '' || !(key in users[0])){
            key = 'distance';
            isReverse = true;
        }
        return users.sort((user1, user2) => {
            const multiplier = (isReverse | 0) * 2 - 1
            if(typeof user1[key] === 'string'){
                return user2[key].localeCompare(user1[key]) * multiplier; 
            }
            return (user1[key] - user2[key]) * multiplier; 
        });
    }

    renderUsers(users, tableBody, userElementName){
        while (tableBody.firstChild) {
            tableBody.removeChild(tableBody.firstChild);
        }
        users.map(user => user[userElementName]).forEach(userElement => {
            userElement.style.display = null;
            tableBody.appendChild(userElement);
        });
    }

    changePage(userResults, page, resultsPerPage, tableBody, userElementName, numPages){
        if(page === 1 && userResults.length === 0){
            this.renderUsers([], tableBody, userElementName);
        }
        if(page < 1 || page > numPages){
            return;
        }
        $('.page-number').removeClass('active');
        $('.page-number').get(page - 1).className += ' active';
        const start = (page - 1) * resultsPerPage;
        const end = page * resultsPerPage;
        const renderUsers = userResults.slice(start, end);
        this.renderUsers(renderUsers, tableBody, userElementName);
        this.currentPage = page;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    //Activate accordions using semantic UI
    $('.ui.accordion').accordion();
    window.table = new UserTable();
});
