# SP.CoreSearch
SharePoint postquery javascript engine

- searching
- sorting
- filtering
- rifiner results
- paging results

## Dependencies

* es6 Promise (or use [polyfill](https://github.com/stefanpenner/es6-promise))

## Demo

![image](https://github.com/d-kochanzhi/SP.CoreSearch/raw/master/src/sp.core.search.gif)

##### this working demo (fetching data, sorting, filtering, paging and refining) contains only 50 rows of unminimize js code

## Demo source (with VueJs)

### Include js to sharepoint page header

```html  
  <script src='<%= SPUtility.MakeBrowserCacheSafeLayoutsUrl("vue.js", false) %>'></script>
  <script src='<%= SPUtility.MakeBrowserCacheSafeLayoutsUrl("es6-promise.auto.min.js", false) %>'></script>
  <script src='<%= SPUtility.MakeBrowserCacheSafeLayoutsUrl("SP.CoreSearch.js", false) %>'></script>
```
### add to page content

```html  

 <div id="app">
    <div class="row">
    <div class="col-md-1"></div>
        <div class="col-md-8">
            <div class="sourcesContainer">         
                <input type="text" v-model="filter.title" placeholder="Search by Title..."  v-on:keyup.enter="doSearch(1)" class="txtSearch" />                      
            </div>   
            <div class="search-message-no-results"  v-if="!hasResults"><h3>Ups...no results</h3></div>
            <div class="panel panel-default" v-else>          
                <div class="panel-body">    
                <table class="table table-striped">
                    <thead>
                    <tr>                  
                        <th>ID</th>
                        <th>Title</th> 
                        <th>SeoKeywords</th>
                    </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in result.PrimaryResults" v-bind:key="item.ListItemID">  
                            <td>{{item.ListItemID}}</td>
                            <td>{{item.Title}}</td> 
                            <td>{{item.SeoKeywords}}</td> 
                        </tr>
                    </tbody>
                </table>                
                </div>
            </div>
            <ul class="containerPager">
                <li v-for="page in result.TotalPages" v-bind:class="{pageButton: true, current: page===result.CurrentPage }"><a href="#" v-on:click.prevent="doSearch(page)">{{page}}</a></li>
            </ul>
        </div>
        <div class="col-md-3">
            <div class="sourcesContainer" v-for="refiner in result.RefinementResults">       
                <div>{{refiner.Name}}</div>
                    <ul>
                        <li v-for="refinerItem in refiner.Items"><a href="#" v-on:click.prevent="setRefinerFilter(refiner.Name, refinerItem)">{{refinerItem.RefinementName}} ({{refinerItem.RefinementCount}})</a> <span v-show="isActiveRefiner(refiner.Name, refinerItem)">&nbsp;&nbsp;X</span></li>
                    </ul>
            </div>
        </div>
    </div>
 </div>
<script type="text/javascript">
        var app = new Vue({
            el: '#app',           
            data: {
                filter: {},
                settings: {},
                result: {},
                __refiners: {}
            },
            mounted: function () {
                var self = this;
                /* uncomment this if scripts not loaded automatically on page
                SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () { });
                SP.SOD.executeFunc('sp.runtime.js', null, function () { });
                SP.SOD.executeFunc('init.js', null, function () { });
                */
                ExecuteOrDelayUntilScriptLoaded(function () {
                    self.onLoad();
                }, "SP.CoreSearch");

            },
            computed: {
                hasResults: function () {
                    return this.result.PrimaryResults && this.result.PrimaryResults.length > 0;
                },
            },
            methods: {
                onLoad: function () {
                    this.settings = new SP.CoreSearch.Settings();
                    this.settings.SelectProperties = ["ListItemID", "Title", "SeoKeywords"];
                    this.settings.QueryTemplate = "{searchterms} ContentTypeId:0x010042A8B2213293034DADE192C571DC80A9*";
                    this.settings.Refiners = "SeoKeywords";

                    this.doSearch(1);
                },
                doSearch: function (page) {
                    var self = this;
                    this.settings.Querytext = this.getQuery();
                    SP.CoreSearch.SearchEngine.Instance.Request(this.settings, page, 4)
                        .then(function (data) {
                            self.result = data;
                        }, function (err) {
                            console.log(err);
                        });
                },
                getQuery: function () {                   
                    return this.filter.title ? ('Title:*' + this.filter.title + '*') : '';
                },                
                setRefinerFilter: function (refiner, refinement) {
                    this.__refiners = this.settings.ApplyRefiner(refiner,refinement.RefinementValue, refinement.RefinementToken);                   
                    this.doSearch(1);
                },
                isActiveRefiner: function (refiner, refinement) {
                    return this.__refiners && this.__refiners[refiner] && this.__refiners[refiner].indexOf(refinement.RefinementValue) > -1;
                }
            }
        });
    </script>

```

All you need is splist
![image](https://github.com/d-kochanzhi/SP.CoreSearch/raw/master/src/standart_list.png)
And enable rifine property on field
![image](https://github.com/d-kochanzhi/SP.CoreSearch/raw/master/src/managed_properties.png)

## SP.CoreSearch.Settings Properties

Option | Type | Description | Default
------------|-----------|-------------|------------
Culture|String|''|'1049'
EnableQueryRules|Bool|''|false
TrimDuplicates|Bool|''|false
SelectProperties|Array|''|["Title"]
Querytext|String|''|''
QueryTemplate|String|''|'{searchterms}'
StartRow|Integer|''|0
RowLimit|Integer|''|10
SortList|Array|''|[]
RefinementFilters|Array|''|[]
Refiners|String|''|''
SourceId|String|''|''
RankingModelId|String|''|''
Instance|Object|new SP.CoreSearch.Settings()|```instanse of class```
### SP.CoreSearch.Settings Methods

Function | Params | Description 
------------|-----------|-------------
ApplyRefiner|field, value, token|''



## SP.CoreSearch.SearchEngine Properties

Option | Type | Description | Default
-------|------|-------------|--------
Instance|Object|new SP.CoreSearch.SearchEngine()|```instanse of class```

### SP.CoreSearch.SearchEngine Methods

Function | Params | Return Object 
------------|-----------|-------------
Request|settings, page, itemsperpage|```{TotalPages: 0,TotalRows: 0,CurrentPage: 0,PrimaryResults: [],RefinementResults: []}```


## License

This project is licensed under the MIT License

