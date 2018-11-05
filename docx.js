var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var docx;
(function (docx) {
    function renderAsync(data, bodyContainer, styleContainer, options) {
        if (styleContainer === void 0) { styleContainer = null; }
        if (options === void 0) { options = null; }
        var parser = new docx.DocumentParser();
        var renderer = new docx.HtmlRenderer(window.document);
        if (options) {
            parser.ignoreWidth = options.ignoreWidth || parser.ignoreWidth;
            parser.ignoreHeight = options.ignoreHeight || parser.ignoreHeight;
            parser.debug = options.debug || parser.debug;
            renderer.className = options.className || "docx";
            renderer.inWrapper = options && options.inWrapper != null ? options.inWrapper : true;
        }
        return Document.load(data, parser)
            .then(function (doc) {
            renderer.render(doc, bodyContainer, styleContainer);
            return doc;
        });
    }
    docx.renderAsync = renderAsync;
    var PartType;
    (function (PartType) {
        PartType["Document"] = "word/document.xml";
        PartType["Style"] = "word/styles.xml";
        PartType["Numbering"] = "word/numbering.xml";
        PartType["DocumentRelations"] = "word/_rels/document.xml.rels";
        PartType["NumberingRelations"] = "word/_rels/numbering.xml.rels";
        PartType["FontRelations"] = "word/_rels/fontTable.xml.rels";
    })(PartType || (PartType = {}));
    var Document = (function () {
        function Document() {
            this.zip = new JSZip();
            this.docRelations = null;
            this.fontRelations = null;
            this.numRelations = null;
            this.styles = null;
            this.fonts = null;
            this.numbering = null;
            this.document = null;
        }
        Document.load = function (blob, parser) {
            var d = new Document();
            return d.zip.loadAsync(blob).then(function (z) {
                var files = [
                    d.loadPart(PartType.DocumentRelations, parser),
                    d.loadPart(PartType.FontRelations, parser),
                    d.loadPart(PartType.NumberingRelations, parser),
                    d.loadPart(PartType.Style, parser),
                    d.loadPart(PartType.Numbering, parser),
                    d.loadPart(PartType.Document, parser)
                ];
                return Promise.all(files.filter(function (x) { return x != null; })).then(function (x) { return d; });
            });
        };
        Document.prototype.loadDocumentImage = function (id) {
            return this.loadResource(this.docRelations, id).then(function (x) { return x ? ("data:image/png;base64," + x) : null; });
        };
        Document.prototype.loadNumberingImage = function (id) {
            return this.loadResource(this.numRelations, id).then(function (x) { return x ? ("data:image/png;base64," + x) : null; });
        };
        Document.prototype.loadFont = function (id) {
            return this.loadResource(this.fontRelations, id)
                .then(function (x) { return x ? ("data:application/vnd.ms-package.obfuscated-opentype;charset=utf-8;base64," + x) : null; });
        };
        Document.prototype.loadResource = function (relations, id) {
            var rel = relations.filter(function (x) { return x.id == id; });
            return rel.length == 0 ? Promise.resolve(null) : this.zip.files["word/" + rel[0].target].async("base64");
        };
        Document.prototype.loadPart = function (part, parser) {
            var _this = this;
            var f = this.zip.files[part];
            return f ? f.async("string").then(function (xml) {
                switch (part) {
                    case PartType.FontRelations:
                        _this.fontRelations = parser.parseDocumentRelationsFile(xml);
                        break;
                    case PartType.DocumentRelations:
                        _this.docRelations = parser.parseDocumentRelationsFile(xml);
                        break;
                    case PartType.NumberingRelations:
                        _this.numRelations = parser.parseDocumentRelationsFile(xml);
                        break;
                    case PartType.Style:
                        _this.styles = parser.parseStylesFile(xml);
                        break;
                    case PartType.Numbering:
                        _this.numbering = parser.parseNumberingFile(xml);
                        break;
                    case PartType.Document:
                        _this.document = parser.parseDocumentFile(xml);
                        break;
                }
                return _this;
            }) : null;
        };
        return Document;
    }());
    docx.Document = Document;
})(docx || (docx = {}));
var docx;
(function (docx) {
    docx.autos = {
        shd: "white",
        color: "black",
        highlight: "transparent"
    };
    var DocumentParser = (function () {
        function DocumentParser() {
            this.skipDeclaration = true;
            this.ignoreWidth = false;
            this.ignoreHeight = true;
            this.debug = false;
        }
        DocumentParser.prototype.parseDocumentRelationsFile = function (xmlString) {
            var xrels = xml.parse(xmlString, this.skipDeclaration);
            return xml.elements(xrels).map(function (c) { return ({
                id: xml.stringAttr(c, "Id"),
                type: values.valueOfRelType(c),
                target: xml.stringAttr(c, "Target"),
            }); });
        };
        DocumentParser.prototype.parseDocumentFile = function (xmlString) {
            var _this = this;
            var result = {
                domType: docx.DomType.Document,
                children: [],
                style: {}
            };
            var xbody = xml.byTagName(xml.parse(xmlString, this.skipDeclaration), "body");
            xml.foreach(xbody, function (elem) {
                switch (elem.localName) {
                    case "p":
                        result.children.push(_this.parseParagraph(elem));
                        break;
                    case "tbl":
                        result.children.push(_this.parseTable(elem));
                        break;
                    case "sectPr":
                        _this.parseSectionProperties(elem, result);
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseStylesFile = function (xmlString) {
            var _this = this;
            var result = [];
            var xstyles = xml.parse(xmlString, this.skipDeclaration);
            xml.foreach(xstyles, function (n) {
                switch (n.localName) {
                    case "style":
                        result.push(_this.parseStyle(n));
                        break;
                    case "docDefaults":
                        result.push(_this.parseDefaultStyles(n));
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseDefaultStyles = function (node) {
            var _this = this;
            var result = {
                id: null,
                name: null,
                target: null,
                basedOn: null,
                styles: []
            };
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "rPrDefault":
                        var rPr = xml.byTagName(c, "rPr");
                        if (rPr)
                            result.styles.push({
                                target: "span",
                                values: _this.parseDefaultProperties(rPr, {})
                            });
                        break;
                    case "pPrDefault":
                        var pPr = xml.byTagName(c, "pPr");
                        if (pPr)
                            result.styles.push({
                                target: "p",
                                values: _this.parseDefaultProperties(pPr, {})
                            });
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseStyle = function (node) {
            var _this = this;
            var result = {
                id: xml.className(node, "styleId"),
                isDefault: xml.boolAttr(node, "default"),
                name: null,
                target: null,
                basedOn: null,
                styles: []
            };
            switch (xml.stringAttr(node, "type")) {
                case "paragraph":
                    result.target = "p";
                    break;
                case "table":
                    result.target = "table";
                    break;
                case "character":
                    result.target = "span";
                    break;
            }
            xml.foreach(node, function (n) {
                switch (n.localName) {
                    case "basedOn":
                        result.basedOn = xml.stringAttr(n, "val");
                        break;
                    case "name":
                        result.name = xml.stringAttr(n, "val");
                        break;
                    case "pPr":
                        result.styles.push({
                            target: "p",
                            values: _this.parseDefaultProperties(n, {})
                        });
                        break;
                    case "rPr":
                        result.styles.push({
                            target: "span",
                            values: _this.parseDefaultProperties(n, {})
                        });
                        break;
                    case "tblPr":
                    case "tcPr":
                        result.styles.push({
                            target: "td",
                            values: _this.parseDefaultProperties(n, {})
                        });
                        break;
                    case "tblStylePr":
                        for (var _i = 0, _a = _this.parseTableStyle(n); _i < _a.length; _i++) {
                            var s = _a[_i];
                            result.styles.push(s);
                        }
                        break;
                    case "rsid":
                    case "qFormat":
                    case "hidden":
                    case "semiHidden":
                    case "unhideWhenUsed":
                    case "autoRedefine":
                    case "uiPriority":
                        break;
                    default:
                        _this.debug && console.warn("DOCX: Unknown style element: " + n.localName);
                }
            });
            return result;
        };
        DocumentParser.prototype.parseTableStyle = function (node) {
            var _this = this;
            var result = [];
            var type = xml.stringAttr(node, "type");
            var selector = "";
            switch (type) {
                case "firstRow":
                    selector = "tr.first-row";
                    break;
                case "lastRow":
                    selector = "tr.last-row";
                    break;
                case "firstCol":
                    selector = "td.first-col";
                    break;
                case "lastCol":
                    selector = "td.last-col";
                    break;
                case "band1Vert":
                    selector = "td.odd-col";
                    break;
                case "band2Vert":
                    selector = "td.even-col";
                    break;
                case "band1Horz":
                    selector = "tr.odd-row";
                    break;
                case "band2Horz":
                    selector = "tr.even-row";
                    break;
                default: return [];
            }
            xml.foreach(node, function (n) {
                switch (n.localName) {
                    case "pPr":
                        result.push({
                            target: selector + " p",
                            values: _this.parseDefaultProperties(n, {})
                        });
                        break;
                    case "rPr":
                        result.push({
                            target: selector + " span",
                            values: _this.parseDefaultProperties(n, {})
                        });
                        break;
                    case "tblPr":
                    case "tcPr":
                        result.push({
                            target: selector,
                            values: _this.parseDefaultProperties(n, {})
                        });
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseNumberingFile = function (xmlString) {
            var _this = this;
            var result = [];
            var xnums = xml.parse(xmlString, this.skipDeclaration);
            var mapping = {};
            var bullets = [];
            xml.foreach(xnums, function (n) {
                switch (n.localName) {
                    case "abstractNum":
                        _this.parseAbstractNumbering(n, bullets)
                            .forEach(function (x) { return result.push(x); });
                        break;
                    case "numPicBullet":
                        bullets.push(_this.parseNumberingPicBullet(n));
                        break;
                    case "num":
                        var numId = xml.stringAttr(n, "numId");
                        var abstractNumId = xml.elementStringAttr(n, "abstractNumId", "val");
                        mapping[abstractNumId] = numId;
                        break;
                }
            });
            result.forEach(function (x) { return x.id = mapping[x.id]; });
            return result;
        };
        DocumentParser.prototype.parseNumberingPicBullet = function (elem) {
            var pict = xml.byTagName(elem, "pict");
            var shape = pict && xml.byTagName(pict, "shape");
            var imagedata = shape && xml.byTagName(shape, "imagedata");
            return imagedata ? {
                id: xml.intAttr(elem, "numPicBulletId"),
                src: xml.stringAttr(imagedata, "id"),
                style: xml.stringAttr(shape, "style")
            } : null;
        };
        DocumentParser.prototype.parseAbstractNumbering = function (node, bullets) {
            var _this = this;
            var result = [];
            var id = xml.stringAttr(node, "abstractNumId");
            xml.foreach(node, function (n) {
                switch (n.localName) {
                    case "lvl":
                        result.push(_this.parseNumberingLevel(id, n, bullets));
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseNumberingLevel = function (id, node, bullets) {
            var _this = this;
            var result = {
                id: id,
                level: xml.intAttr(node, "ilvl"),
                style: {}
            };
            xml.foreach(node, function (n) {
                switch (n.localName) {
                    case "pPr":
                        _this.parseDefaultProperties(n, result.style);
                        break;
                    case "lvlPicBulletId":
                        var id = xml.intAttr(n, "val");
                        result.bullet = bullets.filter(function (x) { return x.id == id; })[0];
                        break;
                    case "lvlText":
                        result.levelText = xml.stringAttr(n, "val");
                        break;
                    case "numFmt":
                        result.format = xml.stringAttr(n, "val");
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseSectionProperties = function (elem, domElem) {
            var _this = this;
            xml.foreach(elem, function (n) {
                switch (n.localName) {
                    case "pgMar":
                        domElem.style["padding-left"] = xml.sizeAttr(n, "left");
                        domElem.style["padding-right"] = xml.sizeAttr(n, "right");
                        domElem.style["padding-top"] = xml.sizeAttr(n, "top");
                        domElem.style["padding-bottom"] = xml.sizeAttr(n, "bottom");
                        break;
                    case "pgSz":
                        if (!_this.ignoreWidth)
                            domElem.style["width"] = xml.sizeAttr(n, "w");
                        if (!_this.ignoreHeight)
                            domElem.style["height"] = xml.sizeAttr(n, "h");
                        break;
                }
            });
        };
        DocumentParser.prototype.parseParagraph = function (node) {
            var _this = this;
            var result = { domType: docx.DomType.Paragraph, children: [] };
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "r":
                        result.children.push(_this.parseRun(c, result));
                        break;
                    case "hyperlink":
                        result.children.push(_this.parseHyperlink(c, result));
                        break;
                    case "bookmarkStart":
                        result.children.push(_this.parseBookmark(c));
                        break;
                    case "pPr":
                        _this.parseParagraphProperties(c, result);
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseParagraphProperties = function (elem, paragraph) {
            var _this = this;
            this.parseDefaultProperties(elem, paragraph.style = {}, null, function (c) {
                switch (c.localName) {
                    case "pStyle":
                        paragraph.className = xml.className(c, "val");
                        break;
                    case "numPr":
                        _this.parseNumbering(c, paragraph);
                        break;
                    case "framePr":
                        _this.parseFrame(c, paragraph);
                        break;
                    case "tabs":
                        _this.parseTabs(c, paragraph);
                        break;
                    case "rPr":
                        break;
                    default:
                        return false;
                }
                return true;
            });
        };
        DocumentParser.prototype.parseNumbering = function (node, paragraph) {
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "numId":
                        paragraph.numberingId = xml.stringAttr(c, "val");
                        break;
                    case "ilvl":
                        paragraph.numberingLevel = xml.intAttr(c, "val");
                        break;
                }
            });
        };
        DocumentParser.prototype.parseFrame = function (node, paragraph) {
            var dropCap = xml.stringAttr(node, "dropCap");
            if (dropCap == "drop")
                paragraph.style["float"] = "left";
        };
        DocumentParser.prototype.parseBookmark = function (node) {
            var result = { domType: docx.DomType.Run };
            result.id = xml.stringAttr(node, "name");
            return result;
        };
        DocumentParser.prototype.parseHyperlink = function (node, parent) {
            var _this = this;
            var result = { domType: docx.DomType.Hyperlink, parent: parent, children: [] };
            var anchor = xml.stringAttr(node, "anchor");
            if (anchor)
                result.href = "#" + anchor;
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "r":
                        result.children.push(_this.parseRun(c, result));
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseRun = function (node, parent) {
            var _this = this;
            var result = { domType: docx.DomType.Run, parent: parent };
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "t":
                        result.text = c.textContent;
                        break;
                    case "br":
                        result.break = xml.stringAttr(c, "type") || "textWrapping";
                        break;
                    case "tab":
                        result.tab = true;
                        break;
                    case "drawing":
                        var d = _this.parseDrawing(c);
                        if (d)
                            result.children = [d];
                        break;
                    case "rPr":
                        _this.parseRunProperties(c, result);
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseRunProperties = function (elem, run) {
            this.parseDefaultProperties(elem, run.style = {}, null, function (c) {
                switch (c.localName) {
                    case "rStyle":
                        run.className = xml.className(c, "val");
                        break;
                    case "vertAlign":
                        switch (xml.stringAttr(c, "val")) {
                            case "subscript":
                                run.wrapper = "sub";
                                break;
                            case "superscript":
                                run.wrapper = "sup";
                                break;
                        }
                        break;
                    default:
                        return false;
                }
                return true;
            });
        };
        DocumentParser.prototype.parseDrawing = function (node) {
            for (var _i = 0, _a = xml.elements(node); _i < _a.length; _i++) {
                var n = _a[_i];
                switch (n.localName) {
                    case "inline":
                    case "anchor":
                        return this.parseDrawingWrapper(n);
                }
            }
        };
        DocumentParser.prototype.parseDrawingWrapper = function (node) {
            var result = { domType: docx.DomType.Drawing, children: [], style: {} };
            var isAnchor = node.localName == "anchor";
            var wrapTopAndBottom = false;
            var simplePos = xml.boolAttr(node, "simplePos");
            var posX = { relative: "page", align: "left", offset: "0" };
            var posY = { relative: "page", align: "top", offset: "0" };
            for (var _i = 0, _a = xml.elements(node); _i < _a.length; _i++) {
                var n = _a[_i];
                switch (n.localName) {
                    case "simplePos":
                        if (simplePos) {
                            posX.offset = xml.sizeAttr(n, "x", SizeType.Emu);
                            posY.offset = xml.sizeAttr(n, "y", SizeType.Emu);
                        }
                        break;
                    case "extent":
                        result.style["width"] = xml.sizeAttr(n, "cx", SizeType.Emu);
                        result.style["height"] = xml.sizeAttr(n, "cy", SizeType.Emu);
                        break;
                    case "positionH":
                    case "positionV":
                        if (!simplePos) {
                            var pos = n.localName == "positionH" ? posX : posY;
                            var alignNode = xml.byTagName(n, "align");
                            var offsetNode = xml.byTagName(n, "posOffset");
                            if (alignNode)
                                pos.align = alignNode.textContent;
                            if (offsetNode)
                                pos.offset = xml.sizeValue(node, SizeType.Emu);
                        }
                        break;
                    case "wrapTopAndBottom":
                        wrapTopAndBottom = true;
                        break;
                    case "graphic":
                        var g = this.parseGraphic(n);
                        if (g)
                            result.children.push(g);
                        break;
                }
            }
            if (wrapTopAndBottom) {
                result.style['display'] = 'block';
                if (posX.align) {
                    result.style['text-align'] = posX.align;
                    result.style['width'] = "100%";
                }
            }
            else if (isAnchor && (posX.align == 'left' || posX.align == 'right')) {
                result.style["float"] = posX.align;
            }
            return result;
        };
        DocumentParser.prototype.parseGraphic = function (elem) {
            var graphicData = xml.byTagName(elem, "graphicData");
            for (var _i = 0, _a = xml.elements(graphicData); _i < _a.length; _i++) {
                var n = _a[_i];
                switch (n.localName) {
                    case "pic":
                        return this.parsePicture(n);
                }
            }
            return null;
        };
        DocumentParser.prototype.parsePicture = function (elem) {
            var result = { domType: docx.DomType.Image, src: "", style: {} };
            var blipFill = xml.byTagName(elem, "blipFill");
            var blip = xml.byTagName(blipFill, "blip");
            result.src = xml.stringAttr(blip, "embed");
            var spPr = xml.byTagName(elem, "spPr");
            var xfrm = xml.byTagName(spPr, "xfrm");
            result.style["position"] = "relative";
            for (var _i = 0, _a = xml.elements(xfrm); _i < _a.length; _i++) {
                var n = _a[_i];
                switch (n.localName) {
                    case "ext":
                        result.style["width"] = xml.sizeAttr(n, "cx", SizeType.Emu);
                        result.style["height"] = xml.sizeAttr(n, "cy", SizeType.Emu);
                        break;
                    case "off":
                        result.style["left"] = xml.sizeAttr(n, "x", SizeType.Emu);
                        result.style["top"] = xml.sizeAttr(n, "y", SizeType.Emu);
                        break;
                }
            }
            return result;
        };
        DocumentParser.prototype.parseTable = function (node) {
            var _this = this;
            var result = { domType: docx.DomType.Table, children: [] };
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "tr":
                        result.children.push(_this.parseTableRow(c));
                        break;
                    case "tblGrid":
                        result.columns = _this.parseTableColumns(c);
                        break;
                    case "tblPr":
                        _this.parseTableProperties(c, result);
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseTableColumns = function (node) {
            var result = [];
            xml.foreach(node, function (n) {
                switch (n.localName) {
                    case "gridCol":
                        result.push({ width: xml.sizeAttr(n, "w") });
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseTableProperties = function (elem, table) {
            var _this = this;
            table.style = {};
            table.cellStyle = {};
            this.parseDefaultProperties(elem, table.style, table.cellStyle, function (c) {
                switch (c.localName) {
                    case "tblStyle":
                        table.className = xml.className(c, "val");
                        break;
                    case "tblpPr":
                        _this.parseTablePosition(c, table);
                        break;
                    default:
                        return false;
                }
                return true;
            });
            switch (table.style["text-align"]) {
                case "center":
                    delete table.style["text-align"];
                    table.style["margin-left"] = "auto";
                    table.style["margin-right"] = "auto";
                    break;
                case "right":
                    delete table.style["text-align"];
                    table.style["margin-left"] = "auto";
                    break;
            }
        };
        DocumentParser.prototype.parseTablePosition = function (node, table) {
            var vertAnchor = xml.stringAttr(node, "vertAnchor");
            var horzAnchor = xml.stringAttr(node, "horzAnchor");
            var tblpX = xml.sizeAttr(node, "tblpX");
            var tblpY = xml.sizeAttr(node, "tblpY");
            var tblpXSpec = xml.stringAttr(node, "tblpXSpec");
            var tblpYSpec = xml.stringAttr(node, "tblpYSpec");
            var topFromText = xml.sizeAttr(node, "topFromText");
            var bottomFromText = xml.sizeAttr(node, "bottomFromText");
            var rightFromText = xml.sizeAttr(node, "rightFromText");
            var leftFromText = xml.sizeAttr(node, "leftFromText");
            table.style["float"] = 'left';
            table.style["margin-bottom"] = values.addSize(table.style["margin-bottom"], bottomFromText);
            table.style["margin-left"] = values.addSize(table.style["margin-left"], leftFromText);
            table.style["margin-right"] = values.addSize(table.style["margin-right"], rightFromText);
            table.style["margin-top"] = values.addSize(table.style["margin-top"], topFromText);
        };
        DocumentParser.prototype.parseTableRow = function (node) {
            var _this = this;
            var result = { domType: docx.DomType.Row, children: [] };
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "tc":
                        result.children.push(_this.parseTableCell(c));
                        break;
                    case "trPr":
                        _this.parseTableRowProperties(c, result);
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseTableRowProperties = function (elem, row) {
            row.style = this.parseDefaultProperties(elem, {}, null, function (c) {
                switch (c.localName) {
                    case "cnfStyle":
                        row.className = values.classNameOfCnfStyle(c);
                        break;
                    default:
                        return false;
                }
                return true;
            });
        };
        DocumentParser.prototype.parseTableCell = function (node) {
            var _this = this;
            var result = { domType: docx.DomType.Cell, children: [] };
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "tbl":
                        result.children.push(_this.parseTable(c));
                        break;
                    case "p":
                        result.children.push(_this.parseParagraph(c));
                        break;
                    case "tcPr":
                        _this.parseTableCellProperties(c, result);
                        break;
                }
            });
            return result;
        };
        DocumentParser.prototype.parseTableCellProperties = function (elem, cell) {
            cell.style = this.parseDefaultProperties(elem, {}, null, function (c) {
                switch (c.localName) {
                    case "gridSpan":
                        cell.span = xml.intAttr(c, "val", null);
                        break;
                    case "vMerge":
                        break;
                    case "cnfStyle":
                        cell.className = values.classNameOfCnfStyle(c);
                        break;
                    default:
                        return false;
                }
                return true;
            });
        };
        DocumentParser.prototype.parseDefaultProperties = function (elem, style, childStyle, handler) {
            var _this = this;
            if (style === void 0) { style = null; }
            if (childStyle === void 0) { childStyle = null; }
            if (handler === void 0) { handler = null; }
            style = style || {};
            xml.foreach(elem, function (c) {
                switch (c.localName) {
                    case "jc":
                        style["text-align"] = values.valueOfJc(c);
                        break;
                    case "textAlignment":
                        style["vertical-align"] = values.valueOfTextAlignment(c);
                        break;
                    case "color":
                        style["color"] = xml.colorAttr(c, "val", null, docx.autos.color);
                        break;
                    case "sz":
                        style["font-size"] = xml.sizeAttr(c, "val", SizeType.FontSize);
                        break;
                    case "shd":
                        style["background-color"] = xml.colorAttr(c, "fill", null, docx.autos.shd);
                        break;
                    case "highlight":
                        style["background-color"] = xml.colorAttr(c, "val", null, docx.autos.highlight);
                        break;
                    case "tcW":
                        if (_this.ignoreWidth)
                            break;
                    case "tblW":
                        style["width"] = values.valueOfSize(c, "w");
                        break;
                    case "trHeight":
                        _this.parseTrHeight(c, style);
                        break;
                    case "strike":
                        style["text-decoration"] = values.valueOfStrike(c);
                        break;
                    case "b":
                        style["font-weight"] = values.valueOfBold(c);
                        break;
                    case "i":
                        style["font-style"] = "italic";
                        break;
                    case "u":
                        _this.parseUnderline(c, style);
                        break;
                    case "ind":
                        _this.parseIndentation(c, style);
                        break;
                    case "rFonts":
                        _this.parseFont(c, style);
                        break;
                    case "tblBorders":
                        _this.parseBorderProperties(c, childStyle || style);
                        break;
                    case "tblCellSpacing":
                        style["border-spacing"] = values.valueOfMargin(c);
                        style["border-collapse"] = "separate";
                        break;
                    case "pBdr":
                        _this.parseBorderProperties(c, style);
                        break;
                    case "tcBorders":
                        _this.parseBorderProperties(c, style);
                        break;
                    case "noWrap":
                        break;
                    case "tblCellMar":
                    case "tcMar":
                        _this.parseMarginProperties(c, childStyle || style);
                        break;
                    case "tblLayout":
                        style["table-layout"] = values.valueOfTblLayout(c);
                        break;
                    case "vAlign":
                        style["vertical-align"] = xml.stringAttr(c, "val");
                        break;
                    case "spacing":
                        _this.parseSpacing(c, style);
                        break;
                    case "lang":
                    case "noProof":
                    case "webHidden":
                        break;
                    default:
                        if (handler != null && !handler(c))
                            _this.debug && console.warn("DOCX: Unknown document element: " + c.localName);
                        break;
                }
            });
            return style;
        };
        DocumentParser.prototype.parseUnderline = function (node, style) {
            var val = xml.stringAttr(node, "val");
            if (val == null || val == "none")
                return;
            switch (val) {
                case "dash":
                case "dashDotDotHeavy":
                case "dashDotHeavy":
                case "dashedHeavy":
                case "dashLong":
                case "dashLongHeavy":
                case "dotDash":
                case "dotDotDash":
                    style["text-decoration-style"] = "dashed";
                    break;
                case "dotted":
                case "dottedHeavy":
                    style["text-decoration-style"] = "dotted";
                    break;
                case "double":
                    style["text-decoration-style"] = "double";
                    break;
                case "single":
                case "thick":
                    style["text-decoration"] = "underline";
                    break;
                case "wave":
                case "wavyDouble":
                case "wavyHeavy":
                    style["text-decoration-style"] = "wavy";
                    break;
                case "words":
                    style["text-decoration"] = "underline";
                    break;
            }
            var col = xml.colorAttr(node, "color");
            if (col)
                style["text-decoration-color"] = col;
        };
        DocumentParser.prototype.parseFont = function (node, style) {
            var ascii = xml.stringAttr(node, "ascii");
            if (ascii)
                style["font-family"] = ascii;
        };
        DocumentParser.prototype.parseIndentation = function (node, style) {
            var firstLine = xml.sizeAttr(node, "firstLine");
            var left = xml.sizeAttr(node, "left");
            var start = xml.sizeAttr(node, "start");
            var right = xml.sizeAttr(node, "right");
            var end = xml.sizeAttr(node, "end");
            if (firstLine)
                style["text-indent"] = firstLine;
            if (left || start)
                style["margin-left"] = left || start;
            if (right || end)
                style["margin-right"] = right || end;
        };
        DocumentParser.prototype.parseSpacing = function (node, style) {
            var before = xml.sizeAttr(node, "before");
            var after = xml.sizeAttr(node, "after");
            var line = xml.sizeAttr(node, "line");
            if (before)
                style["margin-top"] = before;
            if (after)
                style["margin-bottom"] = after;
            if (line) {
                style["line-height"] = line;
                style["min-height"] = line;
            }
        };
        DocumentParser.prototype.parseTabs = function (node, paragraph) {
            paragraph.tabs = xml.elements(node, "tab").map(function (n) { return ({
                position: xml.sizeAttr(n, "pos"),
                leader: xml.stringAttr(n, "leader"),
                style: xml.stringAttr(n, "val"),
            }); });
        };
        DocumentParser.prototype.parseMarginProperties = function (node, output) {
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "left":
                        output["padding-left"] = values.valueOfMargin(c);
                        break;
                    case "right":
                        output["padding-right"] = values.valueOfMargin(c);
                        break;
                    case "top":
                        output["padding-top"] = values.valueOfMargin(c);
                        break;
                    case "bottom":
                        output["padding-bottom"] = values.valueOfMargin(c);
                        break;
                }
            });
        };
        DocumentParser.prototype.parseTrHeight = function (node, output) {
            switch (xml.stringAttr(node, "hRule")) {
                case "exact":
                    output["height"] = xml.sizeAttr(node, "val");
                    break;
                case "atLeast":
                default:
                    output["height"] = xml.sizeAttr(node, "val");
                    break;
            }
        };
        DocumentParser.prototype.parseBorderProperties = function (node, output) {
            xml.foreach(node, function (c) {
                switch (c.localName) {
                    case "start":
                    case "left":
                        output["border-left"] = values.valueOfBorder(c);
                        break;
                    case "end":
                    case "right":
                        output["border-right"] = values.valueOfBorder(c);
                        break;
                    case "top":
                        output["border-top"] = values.valueOfBorder(c);
                        break;
                    case "bottom":
                        output["border-bottom"] = values.valueOfBorder(c);
                        break;
                }
            });
        };
        return DocumentParser;
    }());
    docx.DocumentParser = DocumentParser;
    var SizeType;
    (function (SizeType) {
        SizeType[SizeType["FontSize"] = 0] = "FontSize";
        SizeType[SizeType["Dxa"] = 1] = "Dxa";
        SizeType[SizeType["Emu"] = 2] = "Emu";
        SizeType[SizeType["Border"] = 3] = "Border";
        SizeType[SizeType["Percent"] = 4] = "Percent";
    })(SizeType || (SizeType = {}));
    var xml = (function () {
        function xml() {
        }
        xml.parse = function (xmlString, skipDeclaration) {
            if (skipDeclaration === void 0) { skipDeclaration = true; }
            if (skipDeclaration)
                xmlString = xmlString.replace(/<[?].*[?]>/, "");
            return new DOMParser().parseFromString(xmlString, "application/xml").firstChild;
        };
        xml.elements = function (node, tagName) {
            if (tagName === void 0) { tagName = null; }
            var result = [];
            for (var i = 0; i < node.childNodes.length; i++) {
                var n = node.childNodes[i];
                if (n.nodeType == 1 && (tagName == null || n.localName == tagName))
                    result.push(n);
            }
            return result;
        };
        xml.foreach = function (node, cb) {
            for (var i = 0; i < node.childNodes.length; i++) {
                var n = node.childNodes[i];
                if (n.nodeType == 1)
                    cb(n);
            }
        };
        xml.byTagName = function (elem, tagName) {
            for (var i = 0; i < elem.childNodes.length; i++) {
                var n = elem.childNodes[i];
                if (n.nodeType == 1 && n.localName == tagName)
                    return elem.childNodes[i];
            }
            return null;
        };
        xml.elementStringAttr = function (elem, nodeName, attrName) {
            var n = xml.byTagName(elem, nodeName);
            return n ? xml.stringAttr(n, attrName) : null;
        };
        xml.stringAttr = function (node, attrName) {
            var elem = node;
            for (var i = 0; i < elem.attributes.length; i++) {
                var attr = elem.attributes.item(i);
                if (attr.localName == attrName)
                    return attr.value;
            }
            return null;
        };
        xml.colorAttr = function (node, attrName, defValue, autoColor) {
            if (defValue === void 0) { defValue = null; }
            if (autoColor === void 0) { autoColor = 'black'; }
            var v = xml.stringAttr(node, attrName);
            switch (v) {
                case "yellow":
                    return v;
                case "auto":
                    return autoColor;
            }
            return v ? "#" + v : defValue;
        };
        xml.boolAttr = function (node, attrName, defValue) {
            if (defValue === void 0) { defValue = false; }
            var v = xml.stringAttr(node, attrName);
            switch (v) {
                case "1": return true;
                case "0": return false;
            }
            return defValue;
        };
        xml.intAttr = function (node, attrName, defValue) {
            if (defValue === void 0) { defValue = 0; }
            var val = xml.stringAttr(node, attrName);
            return val ? parseInt(xml.stringAttr(node, attrName)) : 0;
        };
        xml.sizeAttr = function (node, attrName, type) {
            if (type === void 0) { type = SizeType.Dxa; }
            return xml.convertSize(xml.stringAttr(node, attrName), type);
        };
        xml.sizeValue = function (node, type) {
            if (type === void 0) { type = SizeType.Dxa; }
            return xml.convertSize(node.textContent, type);
        };
        xml.convertSize = function (val, type) {
            if (type === void 0) { type = SizeType.Dxa; }
            if (val == null || val.indexOf("pt") > -1)
                return val;
            var intVal = parseInt(val);
            switch (type) {
                case SizeType.Dxa: return (0.05 * intVal).toFixed(2) + "pt";
                case SizeType.Emu: return (intVal / 12700).toFixed(2) + "pt";
                case SizeType.FontSize: return (0.5 * intVal).toFixed(2) + "pt";
                case SizeType.Border: return (0.125 * intVal).toFixed(2) + "pt";
                case SizeType.Percent: return (0.02 * intVal).toFixed(2) + "%";
            }
            return val;
        };
        xml.className = function (node, attrName) {
            var val = xml.stringAttr(node, attrName);
            return val && val.replace(/[ .]+/g, '-').replace(/[&]+/g, 'and');
        };
        return xml;
    }());
    var values = (function () {
        function values() {
        }
        values.valueOfBold = function (c) {
            return xml.boolAttr(c, "val", true) ? "bold" : "normal";
        };
        values.valueOfSize = function (c, attr) {
            var type = SizeType.Dxa;
            switch (xml.stringAttr(c, "type")) {
                case "dxa": break;
                case "pct":
                    type = SizeType.Percent;
                    break;
            }
            return xml.sizeAttr(c, attr, type);
        };
        values.valueOfStrike = function (c) {
            return xml.boolAttr(c, "val", true) ? "line-through" : "none";
        };
        values.valueOfMargin = function (c) {
            return xml.sizeAttr(c, "w");
        };
        values.valueOfRelType = function (c) {
            switch (xml.sizeAttr(c, "Type")) {
                case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings":
                    return docx.DomRelationshipType.Settings;
                case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme":
                    return docx.DomRelationshipType.Theme;
                case "http://schemas.microsoft.com/office/2007/relationships/stylesWithEffects":
                    return docx.DomRelationshipType.StylesWithEffects;
                case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles":
                    return docx.DomRelationshipType.Styles;
                case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable":
                    return docx.DomRelationshipType.FontTable;
                case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image":
                    return docx.DomRelationshipType.Image;
                case "http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings":
                    return docx.DomRelationshipType.WebSettings;
            }
            return docx.DomRelationshipType.Unknown;
        };
        values.valueOfBorder = function (c) {
            var type = xml.stringAttr(c, "val");
            if (type == "nil")
                return "none";
            var color = xml.colorAttr(c, "color");
            var size = xml.sizeAttr(c, "sz", SizeType.Border);
            return size + " solid " + (color == "auto" ? "black" : color);
        };
        values.valueOfTblLayout = function (c) {
            var type = xml.stringAttr(c, "val");
            return type == "fixed" ? "fixed" : "auto";
        };
        values.classNameOfCnfStyle = function (c) {
            var className = "";
            var val = xml.stringAttr(c, "val");
            if (val[0] == "1")
                className += " first-row";
            if (val[1] == "1")
                className += " last-row";
            if (val[2] == "1")
                className += " first-col";
            if (val[3] == "1")
                className += " last-col";
            if (val[4] == "1")
                className += " odd-col";
            if (val[5] == "1")
                className += " even-col";
            if (val[6] == "1")
                className += " odd-row";
            if (val[7] == "1")
                className += " even-row";
            if (val[8] == "1")
                className += " ne-cell";
            if (val[9] == "1")
                className += " nw-cell";
            if (val[10] == "1")
                className += " se-cell";
            if (val[11] == "1")
                className += " sw-cell";
            return className.trim();
        };
        values.valueOfJc = function (c) {
            var type = xml.stringAttr(c, "val");
            switch (type) {
                case "start":
                case "left": return "left";
                case "center": return "center";
                case "end":
                case "right": return "right";
                case "both": return "justify";
            }
            return type;
        };
        values.valueOfTextAlignment = function (c) {
            var type = xml.stringAttr(c, "val");
            switch (type) {
                case "auto":
                case "baseline": return "baseline";
                case "top": return "top";
                case "center": return "middle";
                case "bottom": return "bottom";
            }
            return type;
        };
        values.addSize = function (a, b) {
            if (a == null)
                return b;
            if (b == null)
                return a;
            return "calc(" + a + " + " + b + ")";
        };
        values.checkMask = function (num, mask) {
            return (num & mask) == mask;
        };
        values.classNameOftblLook = function (c) {
            var val = xml.stringAttr(c, "val");
            var num = parseInt(val, 16);
            var className = "";
            if (values.checkMask(num, 0x0020))
                className += " first-row";
            if (values.checkMask(num, 0x0040))
                className += " last-row";
            if (values.checkMask(num, 0x0080))
                className += " first-col";
            if (values.checkMask(num, 0x0100))
                className += " last-col";
            if (!values.checkMask(num, 0x0200))
                className += " odd-row even-row";
            if (!values.checkMask(num, 0x0400))
                className += " odd-col even-col";
            return className.trim();
        };
        return values;
    }());
})(docx || (docx = {}));
var docx;
(function (docx) {
    var DomType;
    (function (DomType) {
        DomType[DomType["Document"] = 0] = "Document";
        DomType[DomType["Paragraph"] = 1] = "Paragraph";
        DomType[DomType["Run"] = 2] = "Run";
        DomType[DomType["Break"] = 3] = "Break";
        DomType[DomType["Table"] = 4] = "Table";
        DomType[DomType["Row"] = 5] = "Row";
        DomType[DomType["Cell"] = 6] = "Cell";
        DomType[DomType["Hyperlink"] = 7] = "Hyperlink";
        DomType[DomType["Drawing"] = 8] = "Drawing";
        DomType[DomType["Image"] = 9] = "Image";
    })(DomType = docx.DomType || (docx.DomType = {}));
    var DomRelationshipType;
    (function (DomRelationshipType) {
        DomRelationshipType[DomRelationshipType["Settings"] = 0] = "Settings";
        DomRelationshipType[DomRelationshipType["Theme"] = 1] = "Theme";
        DomRelationshipType[DomRelationshipType["StylesWithEffects"] = 2] = "StylesWithEffects";
        DomRelationshipType[DomRelationshipType["Styles"] = 3] = "Styles";
        DomRelationshipType[DomRelationshipType["FontTable"] = 4] = "FontTable";
        DomRelationshipType[DomRelationshipType["Image"] = 5] = "Image";
        DomRelationshipType[DomRelationshipType["WebSettings"] = 6] = "WebSettings";
        DomRelationshipType[DomRelationshipType["Unknown"] = 7] = "Unknown";
    })(DomRelationshipType = docx.DomRelationshipType || (docx.DomRelationshipType = {}));
})(docx || (docx = {}));
var docx;
(function (docx) {
    var HtmlRenderer = (function () {
        function HtmlRenderer(htmlDocument) {
            this.htmlDocument = htmlDocument;
            this.inWrapper = true;
            this.className = "docx";
            this.digitTest = /^[0-9]/.test;
        }
        HtmlRenderer.prototype.render = function (document, bodyContainer, styleContainer) {
            if (styleContainer === void 0) { styleContainer = null; }
            this.document = document;
            styleContainer = styleContainer || bodyContainer;
            this.clearElement(styleContainer);
            this.clearElement(bodyContainer);
            styleContainer.appendChild(this.htmlDocument.createComment("docxjs library predefined styles"));
            styleContainer.appendChild(this.renderDefaultStyle());
            styleContainer.appendChild(this.htmlDocument.createComment("docx document styles"));
            styleContainer.appendChild(this.renderStyles(document.styles));
            if (document.numbering) {
                styleContainer.appendChild(this.htmlDocument.createComment("docx document numbering styles"));
                styleContainer.appendChild(this.renderNumbering(document.numbering, styleContainer));
            }
            var documentElement = this.renderDocument(document.document);
            if (this.inWrapper) {
                var wrapper = this.renderWrapper();
                wrapper.appendChild(documentElement);
                bodyContainer.appendChild(wrapper);
            }
            else {
                bodyContainer.appendChild(documentElement);
            }
        };
        HtmlRenderer.prototype.clearElement = function (elem) {
            while (elem.firstChild) {
                elem.removeChild(elem.firstChild);
            }
        };
        HtmlRenderer.prototype.processClassName = function (className) {
            if (!className)
                return this.className;
            return this.className + "_" + className;
        };
        HtmlRenderer.prototype.processStyles = function (styles) {
            var stylesMap = {};
            for (var _i = 0, styles_1 = styles; _i < styles_1.length; _i++) {
                var style = styles_1[_i];
                style.id = this.processClassName(style.id);
                style.basedOn = this.processClassName(style.basedOn);
                stylesMap[style.id] = style;
            }
            for (var _a = 0, styles_2 = styles; _a < styles_2.length; _a++) {
                var style = styles_2[_a];
                if (style.basedOn) {
                    var baseStyle = stylesMap[style.basedOn];
                    var _loop_1 = function (styleValues) {
                        baseValues = baseStyle.styles.filter(function (x) { return x.target == styleValues.target; });
                        if (baseValues && baseValues.length > 0)
                            this_1.copyStyleProperties(baseValues[0].values, styleValues.values);
                    };
                    var this_1 = this, baseValues;
                    for (var _b = 0, _c = style.styles; _b < _c.length; _b++) {
                        var styleValues = _c[_b];
                        _loop_1(styleValues);
                    }
                }
            }
        };
        HtmlRenderer.prototype.processElement = function (element) {
            if (element.children) {
                for (var _i = 0, _a = element.children; _i < _a.length; _i++) {
                    var e = _a[_i];
                    e.className = this.processClassName(e.className);
                    if (e.domType == docx.DomType.Table) {
                        this.processTable(e);
                    }
                    else {
                        this.processElement(e);
                    }
                }
            }
        };
        HtmlRenderer.prototype.processTable = function (table) {
            for (var _i = 0, _a = table.children; _i < _a.length; _i++) {
                var r = _a[_i];
                for (var _b = 0, _c = r.children; _b < _c.length; _b++) {
                    var c = _c[_b];
                    c.style = this.copyStyleProperties(table.cellStyle, c.style, [
                        "border-left", "border-right", "border-top", "border-bottom",
                        "padding-left", "padding-right", "padding-top", "padding-bottom"
                    ]);
                    this.processElement(c);
                }
            }
        };
        HtmlRenderer.prototype.copyStyleProperties = function (input, output, attrs) {
            if (attrs === void 0) { attrs = null; }
            if (!input)
                return output;
            if (output == null)
                output = {};
            if (attrs == null)
                attrs = Object.getOwnPropertyNames(input);
            for (var _i = 0, attrs_1 = attrs; _i < attrs_1.length; _i++) {
                var key = attrs_1[_i];
                if (input.hasOwnProperty(key) && !output.hasOwnProperty(key))
                    output[key] = input[key];
            }
            return output;
        };
        HtmlRenderer.prototype.renderDocument = function (document) {
            var bodyElement = this.htmlDocument.createElement("section");
            bodyElement.className = this.className;
            this.processElement(document);
            this.renderChildren(document, bodyElement);
            this.renderStyleValues(document.style, bodyElement);
            return bodyElement;
        };
        HtmlRenderer.prototype.renderWrapper = function () {
            var wrapper = document.createElement("div");
            wrapper.className = this.className + "-wrapper";
            return wrapper;
        };
        HtmlRenderer.prototype.renderDefaultStyle = function () {
            var styleText = "." + this.className + "-wrapper { background: gray; padding: 30px; display: flex; justify-content: center; } \n                ." + this.className + "-wrapper section." + this.className + " { background: white; box-shadow: 0 0 10px rgba(0, 0, 0, 0.5); }\n                ." + this.className + " { color: black; }\n                section." + this.className + " { box-sizing: border-box; }\n                ." + this.className + " table { border-collapse: collapse; }\n                ." + this.className + " table td, ." + this.className + " table th { vertical-align: top; }\n                ." + this.className + " p { margin: 0pt; }";
            return this.renderStyle(styleText);
        };
        HtmlRenderer.prototype.renderNumbering = function (styles, styleContainer) {
            var _this = this;
            var styleText = "";
            var rootCounters = [];
            var _loop_2 = function () {
                selector = "p." + this_2.numberingClass(num.id, num.level);
                listStyleType = "none";
                if (num.levelText && num.format == "decimal") {
                    var counter = this_2.numberingCounter(num.id, num.level);
                    if (num.level > 0) {
                        styleText += this_2.styleToString("p." + this_2.numberingClass(num.id, num.level - 1), {
                            "counter-reset": counter
                        });
                    }
                    else {
                        rootCounters.push(counter);
                    }
                    styleText += this_2.styleToString(selector + ":before", {
                        "content": this_2.levelTextToContent(num.levelText, num.id),
                        "counter-increment": counter
                    });
                    styleText += this_2.styleToString(selector, __assign({ "display": "list-item", "list-style-position": "inside", "list-style-type": "none" }, num.style));
                }
                else if (num.bullet) {
                    var valiable_1 = ("--" + this_2.className + "-" + num.bullet.src).toLowerCase();
                    styleText += this_2.styleToString(selector + ":before", {
                        "content": "' '",
                        "display": "inline-block",
                        "background": "var(" + valiable_1 + ")"
                    }, num.bullet.style);
                    this_2.document.loadNumberingImage(num.bullet.src).then(function (data) {
                        var text = "." + _this.className + "-wrapper { " + valiable_1 + ": url(" + data + ") }";
                        styleContainer.appendChild(_this.renderStyle(text));
                    });
                }
                else {
                    listStyleType = this_2.numFormatToCssValue(num.format);
                }
                styleText += this_2.styleToString(selector, __assign({ "display": "list-item", "list-style-position": "inside", "list-style-type": listStyleType }, num.style));
            };
            var this_2 = this, selector, listStyleType;
            for (var _i = 0, styles_3 = styles; _i < styles_3.length; _i++) {
                var num = styles_3[_i];
                _loop_2();
            }
            if (rootCounters.length > 0) {
                styleText += this.styleToString("." + this.className + "-wrapper", {
                    "counter-reset": rootCounters.join(" ")
                });
            }
            return this.renderStyle(styleText);
        };
        HtmlRenderer.prototype.renderStyle = function (styleContent) {
            var styleElement = document.createElement("style");
            styleElement.type = "text/css";
            styleElement.innerHTML = styleContent;
            return styleElement;
        };
        HtmlRenderer.prototype.renderStyles = function (styles) {
            var styleText = "";
            this.processStyles(styles);
            for (var _i = 0, styles_4 = styles; _i < styles_4.length; _i++) {
                var style = styles_4[_i];
                for (var _a = 0, _b = style.styles; _a < _b.length; _a++) {
                    var subStyle = _b[_a];
                    var selector = "";
                    if (style.target == subStyle.target)
                        selector += style.target + "." + style.id;
                    else if (style.target)
                        selector += style.target + "." + style.id + " " + subStyle.target;
                    else
                        selector += "." + style.id + " " + subStyle.target;
                    if (style.isDefault && style.target)
                        selector = "." + this.className + " " + style.target + ", " + selector;
                    styleText += this.styleToString(selector, subStyle.values);
                }
            }
            return this.renderStyle(styleText);
        };
        HtmlRenderer.prototype.renderElement = function (elem, parent) {
            switch (elem.domType) {
                case docx.DomType.Paragraph:
                    return this.renderParagraph(elem);
                case docx.DomType.Run:
                    return this.renderRun(elem);
                case docx.DomType.Table:
                    return this.renderTable(elem);
                case docx.DomType.Row:
                    return this.renderTableRow(elem);
                case docx.DomType.Cell:
                    return this.renderTableCell(elem);
                case docx.DomType.Hyperlink:
                    return this.renderHyperlink(elem);
                case docx.DomType.Drawing:
                    return this.renderDrawing(elem);
                case docx.DomType.Image:
                    return this.renderImage(elem);
            }
            return null;
        };
        HtmlRenderer.prototype.renderChildren = function (elem, into) {
            var _this = this;
            var result = null;
            if (elem.children != null)
                result = elem.children.map(function (x) { return _this.renderElement(x, elem); }).filter(function (x) { return x != null; });
            if (into && result)
                result.forEach(function (x) { return into.appendChild(x); });
            return result;
        };
        HtmlRenderer.prototype.renderParagraph = function (elem) {
            var result = this.htmlDocument.createElement("p");
            this.renderClass(elem, result);
            this.renderChildren(elem, result);
            this.renderStyleValues(elem.style, result);
            if (elem.numberingId && elem.numberingLevel != null) {
                result.className = result.className + " " + this.numberingClass(elem.numberingId, elem.numberingLevel);
            }
            return result;
        };
        HtmlRenderer.prototype.renderHyperlink = function (elem) {
            var result = this.htmlDocument.createElement("a");
            this.renderChildren(elem, result);
            this.renderStyleValues(elem.style, result);
            if (elem.href)
                result.href = elem.href;
            return result;
        };
        HtmlRenderer.prototype.renderDrawing = function (elem) {
            var result = this.htmlDocument.createElement("div");
            result.style.display = "inline-block";
            result.style.position = "relative";
            result.style.textIndent = "0px";
            this.renderChildren(elem, result);
            this.renderStyleValues(elem.style, result);
            return result;
        };
        HtmlRenderer.prototype.renderImage = function (elem) {
            var result = this.htmlDocument.createElement("img");
            this.renderStyleValues(elem.style, result);
            if (this.document) {
                this.document.loadDocumentImage(elem.src).then(function (x) {
                    result.src = x;
                });
            }
            return result;
        };
        HtmlRenderer.prototype.renderRun = function (elem) {
            if (elem.break)
                return this.htmlDocument.createElement(elem.break == "page" ? "hr" : "br");
            var result = this.htmlDocument.createElement("span");
            if (elem.text)
                result.textContent = elem.text;
            this.renderClass(elem, result);
            this.renderChildren(elem, result);
            this.renderStyleValues(elem.style, result);
            if (elem.id) {
                result.id = elem.id;
            }
            if (elem.tab) {
            }
            else if (elem.href) {
                var link = this.htmlDocument.createElement("a");
                link.href = elem.href;
                link.appendChild(result);
                return link;
            }
            else if (elem.wrapper) {
                var wrapper = this.htmlDocument.createElement(elem.wrapper);
                wrapper.appendChild(result);
                return wrapper;
            }
            return result;
        };
        HtmlRenderer.prototype.renderTable = function (elem) {
            var result = this.htmlDocument.createElement("table");
            this.renderClass(elem, result);
            this.renderChildren(elem, result);
            this.renderStyleValues(elem.style, result);
            if (elem.columns)
                result.appendChild(this.renderTableColumns(elem.columns));
            return result;
        };
        HtmlRenderer.prototype.renderTableColumns = function (columns) {
            var result = this.htmlDocument.createElement("colGroup");
            for (var _i = 0, columns_1 = columns; _i < columns_1.length; _i++) {
                var col = columns_1[_i];
                var colElem = this.htmlDocument.createElement("col");
                if (col.width)
                    colElem.style.width = col.width + "px";
                result.appendChild(colElem);
            }
            return result;
        };
        HtmlRenderer.prototype.renderTableRow = function (elem) {
            var result = this.htmlDocument.createElement("tr");
            this.renderClass(elem, result);
            this.renderChildren(elem, result);
            this.renderStyleValues(elem.style, result);
            return result;
        };
        HtmlRenderer.prototype.renderTableCell = function (elem) {
            var result = this.htmlDocument.createElement("td");
            this.renderClass(elem, result);
            this.renderChildren(elem, result);
            this.renderStyleValues(elem.style, result);
            if (elem.span)
                result.colSpan = elem.span;
            return result;
        };
        HtmlRenderer.prototype.renderStyleValues = function (style, ouput) {
            if (style == null)
                return;
            for (var key in style) {
                if (style.hasOwnProperty(key)) {
                    ouput.style[key] = style[key];
                }
            }
        };
        HtmlRenderer.prototype.renderClass = function (input, ouput) {
            if (input.className)
                ouput.className = input.className;
        };
        HtmlRenderer.prototype.numberingClass = function (id, lvl) {
            return this.className + "-num-" + id + "-" + lvl;
        };
        HtmlRenderer.prototype.styleToString = function (selectors, values, cssText) {
            if (cssText === void 0) { cssText = null; }
            var result = selectors + " {\r\n";
            for (var key in values) {
                result += "  " + key + ": " + values[key] + ";\r\n";
            }
            if (cssText)
                result += ";" + cssText;
            return result + "}\r\n";
        };
        HtmlRenderer.prototype.numberingCounter = function (id, lvl) {
            return this.className + "-num-" + id + "-" + lvl;
        };
        HtmlRenderer.prototype.levelTextToContent = function (text, id) {
            var _this = this;
            var result = text.replace(/%\d*/g, function (s) {
                var lvl = parseInt(s.substring(1), 10) - 1;
                return "\"counter(" + _this.numberingCounter(id, lvl) + ")\"";
            });
            return '"' + result + '"';
        };
        HtmlRenderer.prototype.numFormatToCssValue = function (format) {
            var mapping = {
                "none": "none",
                "bullet": "disc",
                "decimal": "decimal",
                "lowerLetter": "lower-alpha",
                "upperLetter": "upper-alpha",
                "lowerRoman": "lower-roman",
                "upperRoman": "upper-roman",
            };
            return mapping[format] || format;
        };
        return HtmlRenderer;
    }());
    docx.HtmlRenderer = HtmlRenderer;
})(docx || (docx = {}));
//# sourceMappingURL=docx.js.map