/*
 Dmitry Kochanzhi
 https://github.com/d-kochanzhi
 https://t.me/midpc
 */
(function () {
    'use strict';
    ExecuteOrDelayUntilScriptLoaded(function () {
        if (SP.CoreSearch) return;
        Type.registerNamespace('SP.CoreSearch');

        SP.CoreSearch.Settings = function () {
            this.Culture = "1049";
            this.EnableQueryRules = false;
            this.TrimDuplicates = false;
            this.SelectProperties = ["Title"];
            this.Querytext = '';
            this.QueryTemplate = '{searchterms}';
            this.StartRow = 0;
            this.RowLimit = 10;
            this.SortList = [];
            this.RefinementFilters = [];
            this.Refiners = "";
            this.SourceId = "";
            this.RankingModelId = "";
            this.Anonymous = false;
        }
        SP.CoreSearch.Settings.prototype.PrepareQuery = function () {
            var query = {
                "__metadata": {
                    "type": "Microsoft.Office.Server.Search.REST.SearchRequest"
                },
                "Culture": this.Culture,
                "UILanguage": this.Culture,
                "EnableQueryRules": this.EnableQueryRules,
                "TrimDuplicates": this.TrimDuplicates,
                "SelectProperties": {
                    "results": this.SelectProperties
                },
                "Querytext": this.Querytext,
                "QueryTemplate": this.QueryTemplate,
                "StartRow": this.StartRow,
                "RowLimit": this.RowLimit,
                "EnableSorting": this.SortList.length > 0 ? true : false,
                "SortList": {
                    "results": this.SortList
                },
                "RefinementFilters": {
                    "results": this.RefinementFilters
                },
                "Refiners": this.Refiners,
                "SourceId": this.SourceId,
                "RankingModelId": this.RankingModelId,
                "QueryTemplatePropertiesUrl": "spfile://webroot/queryparametertemplate.xml"
            };

            if (!this.SourceId)
                delete query.SourceId;

            if (!this.RankingModelId)
                delete query.RankingModelId;

            if (!this.Anonymous)
                delete query.QueryTemplatePropertiesUrl;

            return query;
        }
        SP.CoreSearch.Settings.prototype.ApplyRefiner = function (field, value, token) {
            var self = this;
            this.__refiners = this.__refiners || {};
            if (!this.__refiners[field]) {
                this.__refiners[field] = [];
            }

            if (value)
                if (this.__refiners[field].indexOf(value) >= 0) {
                    this.__refiners[field].splice(this.__refiners[field].indexOf(value), 1);
                } else {
                    this.__refiners[field].push(value);
                }

            if (token)
                if (this.__refiners[field].indexOf(token) >= 0) {
                    this.__refiners[field].splice(this.__refiners[field].indexOf(token), 1);
                } else {
                    this.__refiners[field].push(token);
                }

            if (!this.__refiners[field].length) {
                delete this.__refiners[field];
            }

            self.RefinementFilters.splice(0, self.RefinementFilters.length);
            Object.getOwnPropertyNames(this.__refiners).forEach(function (item) {
                var refStr = "";
                self.__refiners[item].forEach(function (i) {
                    if (i.indexOf("??") > -1)
                        refStr += ",{0}".format(i);
                    else
                        refStr += ",equals(\"{0}\")".format(i);
                });
                self.RefinementFilters.push("{0}:or(".format(item) + refStr.substring(1) + ")");
            });

            return this.__refiners;
        },
            SP.CoreSearch.Settings.registerClass('SP.CoreSearch.Settings');
        SP.CoreSearch.Settings.Instance = new SP.CoreSearch.Settings();

        SP.CoreSearch.SearchEngine = function () {
            this.__digest = null;
            this.__settings = new SP.CoreSearch.Settings();
        };
        SP.CoreSearch.SearchEngine.prototype.Request = function (settings, page, itemsperpage) {
            var self = this;

            if (settings !== null && settings instanceof SP.CoreSearch.Settings)
                this.__settings = settings;
            else
                this.__settings = new SP.CoreSearch.Settings();

            // override settings if got params
            if (itemsperpage) {
                this.__settings.RowLimit = itemsperpage;
            }
            if (page) {
                this.__settings.StartRow = (page - 1) * this.__settings.RowLimit;
            }
            // end override

            return new Promise(function (resolve, reject) {
                try {
                    self.__requestDigest().then(
                        function (digest) {
                            var url = "/_api/search/postquery?_=" + (new Date()).getTime();
                            var data = JSON.stringify({ 'request': self.__settings.PrepareQuery() });
                            var headers = {
                                "accept": "application/json;odata=verbose",
                                "Content-Type": "application/json;odata=verbose",
                                "X-RequestDigest": digest.FormDigestValue
                            };

                            self.__httpPost(url, data, headers)
                                .then(function (response) {
                                    resolve(self.__prepareSearchResults(response));
                                }, function (err) {
                                    if (window.console && console.log) {
                                        console.log(err);
                                    }
                                    reject(err);
                                });
                        });

                }
                catch (e) {
                    reject(e);
                }
            });
        };
        SP.CoreSearch.SearchEngine.registerClass('SP.CoreSearch.SearchEngine');
        SP.CoreSearch.SearchEngine.Instance = new SP.CoreSearch.SearchEngine();

        /// #region private
        SP.CoreSearch.SearchEngine.prototype.__httpPost = function (url, data, headers) {
            var self = this;

            return new Promise(function (resolve, reject) {

                var xhr = typeof XMLHttpRequest != 'undefined'
                    ? new XMLHttpRequest()
                    : new ActiveXObject('Microsoft.XMLHTTP');

                xhr.open("POST", url, true);

                if (headers)
                    Object.getOwnPropertyNames(headers).forEach(function (h) {
                        xhr.setRequestHeader(h, headers[h]);
                    });
                xhr.responseType = 'text';

                xhr.onload = function () {
                    if (xhr.status == 200) {
                        resolve(JSON.parse(xhr.response));
                    } else {
                        var error = new Error(xhr.statusText);
                        error.code = xhr.status;
                        reject(error);
                    }
                };

                xhr.onerror = function () {
                    reject(new Error("Network Error"));
                };

                xhr.send(data);
            });
        }
        SP.CoreSearch.SearchEngine.prototype.__requestDigest = function () {
            var self = this;

            return new Promise(function (resolve, reject) {
                if (self.__digest && self.__digest.Date > new Date())
                    resolve(self.__digest);
                else {
                    var url = "/_api/contextinfo?_=" + (new Date()).getTime();
                    var headers = {
                        "accept": "application/json;odata=verbose",
                        "Content-Type": "application/json;odata=verbose",
                    };
                    self.__httpPost(url, null, headers)
                        .then(function (data) {
                            self.__digest = data.d.GetContextWebInformation;
                            self.__digest.Date = new Date(new Date().getTime() + self.__digest.FormDigestTimeoutSeconds * 1000);
                            resolve(self.__digest);
                        }, function (err) {
                            if (window.console && console.log) {
                                console.log(err);
                            }
                            reject(err);
                        });
                }
            });
        }
        SP.CoreSearch.SearchEngine.prototype.__prepareSearchResults = function (results) {
            var responseObj = {
                TotalPages: 0,
                TotalRows: 0,
                CurrentPage: 0,
                PrimaryResults: [],
                RefinementResults: []
            };

            if (results && typeof results === "object") {
                if (results.d.postquery.PrimaryQueryResult) {
                    //PrimaryResults
                    var resultInfo = results.d.postquery.PrimaryQueryResult.RelevantResults;
                    if (resultInfo) {
                        responseObj.TotalRows = resultInfo.TotalRows;
                        responseObj.PrimaryResults = this.__convertPrimaryResultsToObjectArray(resultInfo.Table.Rows.results);
                        responseObj.TotalPages = Math.ceil(responseObj.TotalRows / this.__settings.RowLimit);
                        responseObj.CurrentPage = Math.ceil(this.__settings.StartRow / this.__settings.RowLimit) + 1;
                    }
                    //RefinementResults
                    var refinerInfo = results.d.postquery.PrimaryQueryResult.RefinementResults;
                    if (refinerInfo) {
                        responseObj.RefinementResults = this.__convertRefinersResultsToObjectArray(refinerInfo.Refiners.results);
                    }
                }
            }

            return responseObj;
        }
        SP.CoreSearch.SearchEngine.prototype.__convertPrimaryResultsToObjectArray = function (results) {
            if (!results || results.length === 0) return [];

            var retval = [];
            for (var i = 0; i < results.length; i++) {
                retval.push(this.__convertPrimaryResultsItemToObject(results[i]));
            }

            return retval;
        }
        SP.CoreSearch.SearchEngine.prototype.__convertPrimaryResultsItemToObject = function (result) {
            var item = {};
            var dataCells = result.Cells.results;
            for (var j = 0; j < dataCells.length; j++) {
                var cell = dataCells[j];
                if (cell.Value && (typeof cell.Value !== "string" || cell.Value.trim())) {
                    var val = cell.Value;
                    switch (cell.ValueType) {
                        case "Edm.Double":
                            val = parseFloat(val);
                            break;
                        case "Edm.Int64":
                            val = parseInt(val);
                            break;
                        case "Edm.Boolean":
                            val = val === "true";
                    }

                    item[cell.Key] = val;
                }
            }

            return item;
        }
        SP.CoreSearch.SearchEngine.prototype.__convertRefinersResultsToObjectArray = function (results) {
            if (!results || results.length === 0) return [];

            var retval = [];
            for (var i = 0; i < results.length; i++) {
                retval.push(this.__convertRefinersResultsItemToObject(results[i]));
            }

            return retval;
        }
        SP.CoreSearch.SearchEngine.prototype.__convertRefinersResultsItemToObject = function (result) {
            var item = {};
            item.Name = result.Name;
            item.Items = result.Entries.results;
            return item;
        }
        /// end region

        if (typeof (Sys) !== "undefined" && Sys && Sys.Application) {
            Sys.Application.notifyScriptLoaded();
        }

        NotifyScriptLoadedAndExecuteWaitingJobs("SP.CoreSearch");


    }, "sp.init.js");


})();