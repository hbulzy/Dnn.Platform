if (typeof dcc === 'undefined' || dcc === null) {
    dcc = {};
};

dcc.templatesViewModel = function(config, rootViewModel){
    var self = this;
    var resx = config.resx;
    var settings = config.settings;
    var util = config.util;
    var $rootElement = config.$rootElement;

    self.rootViewModel = rootViewModel;

    self.mode = config.mode;
    self.isSystemUser = settings.isSystemUser;
    self.searchText = ko.observable("");
    self.results = ko.observableArray([]);
    self.totalResults = ko.observable(0);
    self.pageSize = settings.pageSize;
    self.pager_PageDesc = resx.pager_PageDesc;
    self.pager_PagerFormat = resx.templates_PagerFormat;
    self.pager_NoPagerFormat = resx.templates_NoPagerFormat;
    self.selectedTemplate = new dcc.templateViewModel(self, config);

    var findTemplates =  function() {
        self.pageIndex(0);
        self.getTemplates();
    };

    self.addTemplate = function(){
        self.mode("editTemplate");
        self.selectedTemplate.init();
        self.selectedTemplate.bindCodeEditor();
    };

    self.editTemplate = function(data, e) {
        self.selectedTemplate.init();
        util.asyncParallel([
            function(cb1){
                self.getTemplate(data.templateId(), cb1);
            }
        ], function() {
            self.mode("editTemplate");
        });
    };

    self.getTemplate = function (templateId, cb) {
        var params = {
            templateId: templateId
        };
        util.templateService().getEntity(params, "GetTemplate", self.selectedTemplate,
            function(){
                self.selectedTemplate.bindCodeEditor();
            }
        );

        if(typeof cb === 'function') cb();
    };

    self.getTemplates = function () {
        var params = {
            searchTerm: self.searchText(),
            pageIndex: self.pageIndex(),
            pageSize: self.pageSize
        };

        util.templateService().getEntities(params,
            "GetTemplates",
            self.results,
            function() {
                return new dcc.templateViewModel(self, config);
            },
            self.totalResults
        );
    };

    self.init = function() {
        dcc.pager().init(self);
        self.searchText.subscribe(function () {
            findTemplates();
        });

        $rootElement.find("#templates-editView").css("display", "none")
    };

    self.refresh = function(){
        self.getTemplates();
    };
};

dcc.templateViewModel = function(parentViewModel, config){
    var self = this;
    var util = config.util;
    var resx = config.resx;
    var settings = config.settings;
    var codeEditor = config.codeEditor;

    var $rootElement = config.$rootElement;
    var $contextMenu = $rootElement.find("#templateEditorContextMenu");

    self.parentViewModel = parentViewModel;
    self.rootViewModel = parentViewModel.rootViewModel;

    self.canEdit = ko.observable(false);
    self.canSelectGlobal = ko.observable(false);
    self.templateId = ko.observable(-1);
    self.localizedNames = ko.observableArray([]);
    self.contentType = ko.observable('');
    self.contentTypeId = ko.observable(-1);
    self.filePath = ko.observable('');
    self.isSystem = ko.observable(false);
    self.content = ko.observable('');
    self.selected = ko.observable(false);

    self.codeSnippets = ko.observableArray([]);
    self.contentTypes = ko.observableArray([]);
    self.contentFields = ko.observableArray([]);

    self.isAddMode = ko.computed(function() {
        return self.templateId() == -1;
    });

    self.name = ko.computed({
        read: function () {
            return util.getLocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedNames());
        },
        write: function(value) {
            util.setlocalizedValue(self.rootViewModel.selectedLanguage(), self.localizedNames(), value);
        }
    });

    self.name.subscribe(function(newValue) {
        if (self.filePath() === "" && newValue !== "") {
            self.filePath("Content Templates/" + newValue.replace(" ", "") + ".cshtml");
        }
    });

    self.contentTypeId.subscribe(function() {
        var isSystemType = false;
        var contentTypes = self.contentTypes();
        var contentTypeId = self.contentTypeId();
        for (var i = 0; i < contentTypes.length; i++) {
            var contentType = contentTypes[i];
            if (contentType.contentTypeId == contentTypeId) {
                isSystemType = contentType.isSystem;
                break;
            }
        }
        self.canSelectGlobal(self.parentViewModel.isSystemUser && self.isAddMode() && isSystemType);
        self.isSystem(false);
    })

    var getCodeSnippets = function() {
        var params = { };

        util.templateService().get("GetSnippets", params,
            function(data) {
                if (typeof data !== "undefined" && data != null && data.success === true) {
                    //Success
                    self.codeSnippets.removeAll();
                    for(var i = 0; i < data.data.results.length; i++){
                        var result = data.data.results[i];
                        self.codeSnippets.push({
                            name: result.name,
                            snippet: result.snippet,
                        });
                    }
                } else {
                    //Error
                }
            },

            function(){
                //Failure
            }
        );
    };

    var getContentFields = function() {
        if(self.contentTypeId() !== "undefined" && self.contentTypeId() > 0){
            var params = {
                contentTypeId: self.contentTypeId()
            };

            util.contentTypeService().get("GetContentFields", params,
                function(data) {
                    if (typeof data !== "undefined" && data != null && data.success === true) {
                        //Success
                        self.contentFields.removeAll();
                        for(var i = 0; i < data.data.results.length; i++){
                            var result = data.data.results[i];
                            var localizedNames = ko.observableArray([]);
                            util.loadLocalizedValues(localizedNames, result.localizedNames);
                            var localizedDescriptions = ko.observableArray([]);
                            util.loadLocalizedValues(localizedDescriptions, result.localizedDescriptions);
                            var localizedLabels = ko.observableArray([]);
                            util.loadLocalizedValues(localizedLabels, result.localizedLabels);
                            self.contentFields.push({
                                contentTypeId: result.contentTypeId,
                                contentFieldId: result.contentFieldId,
                                name: util.getLocalizedValue(self.rootViewModel.selectedLanguage(), localizedNames()),
                                label: util.getLocalizedValue(self.rootViewModel.selectedLanguage(), localizedDescriptions()),
                                description: util.getLocalizedValue(self.rootViewModel.selectedLanguage(), localizedLabels())
                            });
                        }
                    } else {
                        //Error
                    }
                },

                function(){
                    //Failure
                }
            );
        }
    };

    var getContentTypes = function() {
        var params = {
            searchTerm: '',
            pageIndex: 0,
            pageSize: 1000
        };

        util.contentTypeService().get("GetContentTypes", params,
            function(data) {
                if (typeof data !== "undefined" && data != null && data.success === true) {
                    //Success
                    self.contentTypes.removeAll();
                    for(var i = 0; i < data.data.results.length; i++){
                        var result = data.data.results[i];
                        var localizedValues = ko.observableArray([]);
                        util.loadLocalizedValues(localizedValues, result.localizedNames);
                        self.contentTypes.push({
                            contentTypeId: result.contentTypeId,
                            isSystem: result.isSystem,
                            name: util.getLocalizedValue(self.rootViewModel.selectedLanguage(), localizedValues())
                        });
                    }
                } else {
                    //Error
                }
            },

            function(){
                //Failure
            }
        );
    };

    self.bindCodeEditor = function() {
        codeEditor.setValue(self.content());
    };

    self.cancel = function(){
        self.rootViewModel.closeEdit();
    };

    self.deleteTemplate = function (data, e) {
        util.confirm(resx.deleteTemplateConfirmMessage, resx.yes, resx.no, function() {
            var params = {
                templateId: data.templateId(),
                name: data.name(),
                contentTypeId: data.contentTypeId(),
                isSystem: data.isSystem(),
                filePath: data.filePath(),
                content: codeEditor.getValue()
            };

            util.templateService().post("DeleteTemplate", params,
                function(data){
                    //Success
                    parentViewModel.refresh();
                },

                function(data){
                    //Failure
                }
            );
        });
    };

    self.init = function(){
        self.canEdit(true);
        self.templateId(-1);
        self.contentType("");
        self.contentTypeId(-1);
        self.filePath('');
        self.isSystem(self.parentViewModel.isSystemUser);
        self.content('');

        util.initializeLocalizedValues(self.localizedNames, self.rootViewModel.languages());

        self.contentTypeId.subscribe(function () {
            getContentFields();
        });

        getCodeSnippets();
        getContentTypes();
    };

    self.insertField = function(data) {
        var doc = codeEditor.doc;
        doc.replaceSelection("@Model.Fields[" + data.name + "].value");
        $contextMenu.hide();
    };

    self.inserSnippet = function(data) {
        var doc = codeEditor.doc;
        doc.replaceSelection(data.snippet);
        $contextMenu.hide();
    };

    self.load = function(data) {
        self.canEdit(data.canEdit);
        self.templateId(data.templateId);
        self.contentType(data.contentType);
        self.contentTypeId(data.contentTypeId);
        self.isSystem(data.isSystem);
        self.filePath(data.filePath);
        self.content(data.content);

        util.loadLocalizedValues(self.localizedNames, data.localizedNames)
   };

    self.saveTemplate = function(data, e) {
        var jsObject = ko.toJS(data);
        var params = {
            templateId: jsObject.templateId,
            localizedNames: jsObject.localizedNames,
            contentTypeId: jsObject.contentTypeId,
            isSystem: jsObject.isSystem,
            filePath: jsObject.filePath,
            content: codeEditor.getValue()
        };

        util.templateService().post("SaveTemplate", params,
            function(data) {
                //Success
                self.cancel();
            },
            function(data) {
                //Failure
            }
        );
    };

    self.toggleSelected = function() {
        self.selected(!self.selected());
    };

    var $codeEditor = $rootElement.find(".CodeMirror");
    $codeEditor.bind("contextmenu", function (event) {
        event.preventDefault();

        var cursorLocation = codeEditor.cursorCoords();

        $contextMenu.show();
        $contextMenu.offset({ top: cursorLocation.top, left: cursorLocation.left });

        return false;
    });

    codeEditor.on("mousedown", function(instance, event) {
        $contextMenu.hide();
    });
}