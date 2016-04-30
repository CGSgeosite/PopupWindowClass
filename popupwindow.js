/* PopupWindowClass 弹出式窗口类，需要leaflet提供的L.Class、L.Draggable类支持

主要特点：
    1、支持模式和非模式两种窗口形态
    2、支持标题栏平移拖放和边角缩放
    3、支持定时驻留

用法：var openPopupWindow = new PopupWindowClass("标题栏文本", 'HTML内容', {选项对象});
其中，选项对象包括：
    pool: null, //窗口的存放池-DOM对象，默认或省略时，创建的窗口将追加到document.body对象的末尾
    zIndex: null, //窗口的层序控制因子，数字越大越处于顶层！该值将影响类静态成员zIndex的值，默认值：12345
    model: true, //是否按模式（被覆盖的层不响应任何交互操作）窗口进行渲染，默认为真（模式）
    top: null, //窗口左上角距离父级顶部的纵向像素偏移量，默认或忽略时自动以中央位置计算偏移量
    left: null, //窗口左上角距离父级左边缘横向像素偏移量，默认或忽略时自动以中央位置计算偏移量
    width: null, //版心像素宽度，省略时取默认值：自动按主窗口宽度的80%设置
    height: null, //版心像素高度，省略时取默认值：自动按主窗口高度的80%设置
    padding:2, //实际内容距离窗口边框多少个像素，默认值：2个像素，需大于等于0
    color: "#f2f2f2", //窗口底色
    borderColor: "#2a8bd7", //圆角边框颜色
    borderWidth: 1, //圆角边框的像素宽度，需大于等于0
    borderRadius: 4, //圆角边框的曲率半径（像素单位）
    borderShadowOpacity: 85, //圆角边框阴影的透明度 0---100，默认85
    borderShadowRing: 5, //圆角边框阴影环的宽度或高度像素尺寸（该值也标识了鼠标事件响应区），默认5
    maskColor: "gray", //屏蔽膜的颜色
    maskOpacity: 45, //屏蔽膜的透明度 0---100之间，默认45
    zoomButton: true, //控制是否出现缩放按钮，默认在左上角出现可缩放的置换箭头
    draggable: true, //控制是否可拖动和平移窗口，默认可以
    expand: true, //控制窗口是否展开，默认是展开态
    closeImage: 'images/delete.gif', //指定关闭按钮的图片url
    closeImageSize: { width: 16, height: 16 }, //指定关闭按钮图片的像素高度和宽度
    titleHeight: 24, //窗口标题栏的像素高度，要求一定要大于或等于closeImageSize属性中关闭图片的高度height，并且应为偶数（以便padding等分！）
    age: 0 //窗口的驻留时间 毫秒数，若小于等于0：始终驻留；若大于0：驻留指定的毫秒数后自动消失（自动执行关闭操作）

接口函数：
    1、类构造函数，通过new将自动调用构造函数initialize并传递参数，将按指定参数对窗口的样式和内容进行渲染展现
    2、close，关闭模式窗口，将自动注销所有事件句柄，删除dom对象以及相关html元素

事件机制：
    1、窗口出现后，触发：open事件，携带宽度和高度对象
    2、窗口关闭后，触发：close事件
    3、窗口最大化和最小化时，触发：zoomin和zoomout事件
    4、窗口缩放后，触发：Right Bottom RightBottom LeftBottom RightTop Left Top LeftTop事件，并携带宽度和高度对象

用法举例：
    1、设置窗口的宽度和高度分别为160和90像素，驻留5秒后自动关闭，屏蔽层的透明度为0，不显示缩放箭头，关闭边框的缩放功能，侦听窗口关闭事件并弹出alert窗口
        var openPopupWindow = new PopupWindowClass("标题栏文本", 'HTML内容', { width: 160, height: 90, age: 5000, maskColor: "#ffffff", maskOpacity: 0, zoomButton: false, draggable:false});
    2、显示一个微小的等待效果
        var openPopupWindow = new PopupWindowClass(null, null, { width: 0, height: 0, maskColor: "white", maskOpacity: 100, zoomButton: false, draggable: false, expand: false, closeImage: 'images/waiting.gif', borderShadowOpacity: 0, borderColor: 'white', color: 'white' });
    3、响应关闭事件    
        openPopupWindow.once("close", function() {alert("窗口刚关闭!")}, this);
*/

//特别注意：leaflet0.7.7版的L.DomUtil.getPosition函数未考虑边界效应，这里暂直接采用1.0版的替代之。同时注意，必须先嵌入leaflet.js，然后再嵌入本脚本！
L.DomUtil.getPosition = function (el) {
    // 下行是0.7.7版
    //return el._leaflet_pos; 
    // 下行是1.0版
    return el._leaflet_pos || new L.Point(0, 0);
};

var PopupWindowClass = L.Class.extend({

    //0.7.7采用L.Mixin.Events，1.0版不需要！
    includes: L.Mixin.Events, 

    statics: {
        zIndex: 12345 //基于本类产生的若干对象中，首次创建的对象的最底层序编号
    },

    options: {
        pool: null, //窗口的存放池-DOM对象，默认或省略时，创建的窗口将追加到document.body对象的末尾
        zIndex: null, //窗口的层序控制因子，数字越大越处于顶层！该值将影响类静态成员zIndex的值，默认值：12345
        model: true, //是否按模式（被覆盖的层不响应任何交互操作）窗口进行渲染，默认为真（模式）
        top: null, //窗口左上角距离父级顶部的纵向像素偏移量，默认或忽略时自动以中央位置计算偏移量
        left: null, //窗口左上角距离父级左边缘横向像素偏移量，默认或忽略时自动以中央位置计算偏移量
        width: null, //版心像素宽度，省略时取默认值：自动按主窗口宽度的80%设置
        height: null, //版心像素高度，省略时取默认值：自动按主窗口高度的80%设置
        padding:2, //实际内容距离窗口边框多少个像素，默认值：2个像素，需大于等于0
        color: "#f2f2f2", //窗口底色
        borderColor: "#2a8bd7", //圆角边框颜色
        borderWidth: 1, //圆角边框的像素宽度，需大于等于0
        borderRadius: 4, //圆角边框的曲率半径（像素单位）
        borderShadowOpacity: 85, //圆角边框阴影的透明度 0---100，默认85
        borderShadowRing: 5, //圆角边框阴影环的宽度或高度像素尺寸（该值也标识了鼠标事件响应区），默认5
        maskColor: "gray", //屏蔽膜的颜色
        maskOpacity: 45, //屏蔽膜的透明度 0---100之间，默认45
        zoomButton: true, //控制是否出现缩放按钮，默认在左上角出现可缩放的置换箭头
        draggable: true, //控制是否可拖动和平移窗口，默认可以
        expand: true, //控制窗口是否展开，默认是展开态
        closeImage: 'images/delete.gif', //指定关闭按钮的图片url
        closeImageSize: { width: 16, height: 16 }, //指定关闭按钮图片的像素高度和宽度
        titleHeight: 24, //窗口标题栏的像素高度，要求一定要大于或等于closeImageSize属性中关闭图片的高度height，并且应为偶数（以便padding等分！）
        age: 0 //窗口的驻留时间 毫秒数，若小于等于0：始终驻留；若大于0：驻留指定的毫秒数后自动消失（自动执行关闭操作）
    },

    initialize: function (
        title, //标题文本
        content, //内容
        options
    ) {
        var self = this;
        self.open = false;
        var id = self.id = '_' + L.stamp(self);
        L.setOptions(self, options);
        options = self.options;
        if (options.pool)
            options.pool.appendChild(self._frame());
        else
            document.body.appendChild(self._frame());

        var popupWindowMask = null;
        if (options.model)
            popupWindowMask = self.Mask = $("popupWindowMask" + id);

        var popupWindow = self.Popup = $("popupWindow" + id);

        var popupWindowLeftTop = self.LeftTop = $("popupWindowLeftTop" + id);
        var popupWindowTop = self.Top = $("popupWindowTop" + id);
        var popupWindowRightTop = self.RightTop = $("popupWindowRightTop" + id);

        var popupWindowLeft = self.Left = $("popupWindowLeft" + id);
        //var popupWindowMiddle = self.Middle = $("popupWindowMiddle" + id);
        self.Center = $("popupWindowCenter" + id);

        if (options.zoomButton) {
            self.Show = $("popupWindowShow" + id);
            self.ShowControl = $("popupWindowShowControl" + id);
        } else {
            self.Show = null;
        }
        var popupWindowShow = self.Show;
        var popupWindowTitle = self.Title = $("popupWindowTitle" + id);
        var popupWindowClose = self.Close = $("popupWindowClose" + id);
        var popupWindowHtml = self.Html = $("popupWindowHtml" + id);
        var popupWindowRight = self.Right = $("popupWindowRight" + id);

        var popupWindowLeftBottom = self.LeftBottom = $("popupWindowLeftBottom" + id);
        var popupWindowBottom = self.Bottom = $("popupWindowBottom" + id);
        var popupWindowRightBottom = self.RightBottom = $("popupWindowRightBottom" + id);

        var screenWidth = Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth);
        var screenHeight = Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);

        var titleHeight = options.titleHeight;
        var ring = options.borderShadowRing * 1;
        var width = options.width;
        var padding = options.padding*1;
        var borderWidth = options.borderWidth * 1;

        width = Math.max(Math.min
        (
            (width == null || width < 0 ? screenWidth * 0.8 : parseInt(width)
                    + ring //左阴影宽
                    + borderWidth //左边框宽
                    + padding //左padding宽
                    + padding //右padding
                    + borderWidth //右边框宽
                    + ring //右阴影宽
            ),
            screenWidth * 0.95
        ), options.closeImageSize.width * (options.zoomButton ? 2 : 1) + ring + borderWidth + padding + padding + borderWidth + ring);
        var height = options.height;
        height = Math.min
            (
                (height == null || height < 0 ? screenHeight * 0.8 : parseInt(height)
                + ring //顶部阴影高
                + borderWidth //上边框高
                + titleHeight //标题栏高
                + 1 //标题栏下边框高
                + padding //上padding高
                + padding //下padding高
                + borderWidth //下边框高
                + ring //底部阴影高
                ),
                screenHeight * 0.95
            );

        var style = popupWindow.style;
        style.top = (options.top == null ? (screenHeight - height) / 2 : parseInt(options.top)) + "px";
        style.left = (options.left == null ? (screenWidth - width) / 2 : parseInt(options.left)) + "px";
        style.width = width + "px";
        style.height = height + "px";

        popupWindowHtml.style.height =
        (
            self.HtmlHeight =
                height
                - ring //顶部阴影高
                - ring //底部阴影高
                - borderWidth //上边框高
                - 1 //标题栏下边框高
                - borderWidth //下边框高
                - titleHeight  //标题栏高度 
                - 2 * padding //中间内容容器的padding高度
        ) + "px";

        popupWindowHtml.style.width =
        (
            self.HtmlWidth =
                width
                - ring //左阴影宽
                - ring //右阴影宽
                - borderWidth //左边框宽
                - borderWidth //右边框宽
                - 2 * padding //中间内容容器的padding宽度
        ) + "px";

        title && (popupWindowTitle.innerHTML = title);
        content && (popupWindowHtml.innerHTML = content);

        style.display = 'block';
        options.model && (popupWindowMask.style.display = 'block');
        self.open = true;

        self.options.expand = !self.options.expand;
        self._show();

        L.DomEvent.on(popupWindowClose, "click", self.close, self);
        options.model && L.DomEvent.on(popupWindowMask, "click", self.close, self);
        popupWindowShow && L.DomEvent.on(popupWindowShow, "click", self._show, self);

        if (options.draggable) {
            if (!self.Title_draggable)
                self.Title_draggable = new L.Draggable
                (
                    popupWindow, 
                    popupWindowTitle 
                );
            //注意：拖拉效果在ie9及其以下版本体验有瞬间错位（首次拖拉时发生）
            self.Title_draggable.enable();

            if (!self.LeftBottom_draggable)
                self.LeftBottom_draggable = new L.Draggable
                (
                    popupWindowLeftBottom 
                );

            if (!self.Left_draggable)
                self.Left_draggable = new L.Draggable
                (
                    popupWindowLeft 
                );

            if (!self.LeftTop_draggable)
                self.LeftTop_draggable = new L.Draggable
                (
                    popupWindowLeftTop 
                );

            if (!self.Top_draggable)
                self.Top_draggable = new L.Draggable
                (
                    popupWindowTop 
                );

            if (!self.RightTop_draggable)
                self.RightTop_draggable = new L.Draggable
                (
                    popupWindowRightTop 
                );

            if (!self.Right_draggable)
                self.Right_draggable = new L.Draggable
                (
                    popupWindowRight 
                );

            if (!self.Bottom_draggable)
                self.Bottom_draggable = new L.Draggable
                (
                    popupWindowBottom 
                );

            if (!self.RightBottom_draggable)
                self.RightBottom_draggable = new L.Draggable
                (
                    popupWindowRightBottom 
                );

            self.LeftBottom_draggable._updatePosition =
                self.Left_draggable._updatePosition =
                self.RightTop_draggable._updatePosition =
                self.Top_draggable._updatePosition =
                self.LeftTop_draggable._updatePosition =
                self.Right_draggable._updatePosition =
                self.Bottom_draggable._updatePosition =
                self.RightBottom_draggable._updatePosition =
                function () {
                    var e = { originalEvent: this._lastEvent };
                    this.fire('predrag', e);
                    //L.DomUtil.setPosition(this._element, this._newPos);
                    this.fire('drag', e);
                };
            var DragEvent = self.DragEvent = {
                'dragstart': this._onDragStart,
                'drag': this._onDrag
            };

            self.LeftBottom_draggable.on(DragEvent, self);
            self.LeftBottom_draggable.enable();

            self.Left_draggable.on(DragEvent, self);
            self.Left_draggable.enable();

            self.RightBottom_draggable.on(DragEvent, self);
            self.RightBottom_draggable.enable();

            self.Bottom_draggable.on(DragEvent, self);
            self.Bottom_draggable.enable();

            self.Right_draggable.on(DragEvent, self);
            self.Right_draggable.enable();

            self.LeftTop_draggable.on(DragEvent, self);
            self.LeftTop_draggable.enable();

            self.Top_draggable.on(DragEvent, self);
            self.Top_draggable.enable();

            self.RightTop_draggable.on(DragEvent, self);
            self.RightTop_draggable.enable();
        }

        if (options.age > 0)
            setTimeout(L.bind(self.close, self), options.age);

        self.fire('open', { width: width - ring - ring, height: height - ring - ring });
    },
    _show: function () {
        var self = this;
        var options = self.options;
        var ring = options.borderShadowRing;
        var padding = options.padding * 1;
        var titleHeight = options.titleHeight;
        var borderWidth = options.borderWidth * 1;
        var expand = options.expand = !options.expand;
        self.Center.style.height = expand ? null : titleHeight + "px";
        self.Popup.style.height =
        (
            expand
                ?
                self.HtmlHeight + 2 * padding + 1
                :
                0
        ) + (titleHeight + ring + borderWidth + ring + borderWidth) + "px";
        self.Show && (self.ShowControl.src = "images/arrow/1" + (expand ? "0" : "1") + ".gif?" + Math.random());
        self.fire('zoom' + (expand ? 'in' : 'out'));
    }
    ,
    _onDragStart: function (e) {
        this._oldPos = e.target._newPos;
    },
    _onDrag: function (e) {
        var self = this;
        var options = self.options;
        if (options.expand) {
            var _newPos = e.target._newPos;
            var xy = _newPos.subtract(self._oldPos);
            var popupWindow = self.Popup;
            var popupWindowstyle = popupWindow.style;
            var height = popupWindow.clientHeight, width = popupWindow.clientWidth;
            var bounder = e.target._element.id.replace(/popupWindow(.*?)_.*/img, "$1");
            switch (bounder) {
                case "Right":
                    width += xy.x;
                    break;
                case "Bottom":
                    height += xy.y;
                    break;
                case "RightBottom":
                    height += xy.y;
                    width += xy.x;
                    break;
                case "LeftBottom":
                    height += xy.y;
                    width -= xy.x;
                    if (width > 0 && height > 0)
                        popupWindowstyle.left = (parseInt(popupWindowstyle.left) + xy.x) + "px";
                    break;
                case "RightTop":
                    height -= xy.y;
                    width += xy.x;
                    if (width > 0 && height > 0)
                        popupWindowstyle.top = (parseInt(popupWindowstyle.top) + xy.y) + "px";
                    break;
                case "Left":
                    width -= xy.x;
                    if (width > 0)
                        popupWindowstyle.left = (parseInt(popupWindowstyle.left) + xy.x) + "px";
                    break;
                case "Top":
                    height -= xy.y;
                    if (height > 0)
                        popupWindowstyle.top = (parseInt(popupWindowstyle.top) + xy.y) + "px";
                    break;
                default: //LeftTop
                    height -= xy.y;
                    width -= xy.x;
                    if (width > 0 && height > 0) {
                        popupWindowstyle.top = (parseInt(popupWindowstyle.top) + xy.y) + "px";
                        popupWindowstyle.left = (parseInt(popupWindowstyle.left) + xy.x) + "px";
                    }
                    break;
            }

            if (width > 0 && height > 0) {
                var ring = options.borderShadowRing*1;
                var padding = options.padding * 1;
                var borderWidth = options.borderWidth * 1;
                popupWindowstyle.height = height + "px";
                popupWindowstyle.width = width + "px";
                self.Html.style.width = (self.HtmlWidth = width - ring - borderWidth - padding - padding - borderWidth - ring) + "px";
                self.Html.style.height = (self.HtmlHeight = height - ring - borderWidth - options.titleHeight - 1 - padding - padding - borderWidth - ring) + "px";
                self._oldPos = _newPos;
                self.fire(bounder, { width: width - ring - ring, height: height - ring - ring });
            }
        }
    },
    _frame: function () {
        var self = this;
        var options = self.options;
        var zIndex = options.zIndex;
        if (zIndex !== null && zIndex > PopupWindowClass.zIndex)
            PopupWindowClass.zIndex = zIndex;
        var ring = options.borderShadowRing * 1;
        var padding = options.padding * 1;
        var id = self.id;
        var maskOpacity = options.maskOpacity;
        var borderShadowOpacity = options.borderShadowOpacity * 0.01;
        var titleHeight = options.titleHeight;
        var borderWidth = options.borderWidth * 1;
        var imagewidth = options.closeImageSize.width;
        var imageheight = options.closeImageSize.height;
        var imagepadding = (titleHeight - imageheight) / 2;
        
        var htmlpage = [];
        options.model && htmlpage.push('<div id="popupWindowMask' + id + '" style="display:none;position:absolute;top:0%;left:0%;width:100%;height:100%;background-color:' + options.maskColor + ';z-index:' + (PopupWindowClass.zIndex++) + ';-moz-opacity:' + maskOpacity * 0.01 + ';opacity:' + maskOpacity * 0.01 + ';-webkit-filter:alpha(opacity=' + maskOpacity + ');-moz-filter:alpha(opacity=' + maskOpacity + ');-o-filter:alpha(opacity=' + maskOpacity + ');filter:alpha(opacity=' + maskOpacity + ');"></div>');

        htmlpage.push('<table id="popupWindow' + id + '" cellpadding="0" cellspacing="0" border="0" style="display:none;position:absolute;z-index:' + (PopupWindowClass.zIndex++) + ';overflow:hidden;">');
        htmlpage.push('<tr style="height:' + ring + 'px"><td id="popupWindowLeftTop' + id + '" style="width:' + ring + 'px;' + (options.draggable ? 'cursor:nw-resize;' : '') + '"></td><td id="popupWindowTop' + id + '"' + (options.draggable ? ' style="cursor:n-resize"' : '') + '></td><td id="popupWindowRightTop' + id + '" style="width:' + ring + 'px;' + (options.draggable ? 'cursor:ne-resize;' : '') + '"></td></tr>');
        htmlpage.push('<tr><td id="popupWindowLeft' + id + '"' + (options.draggable ? ' style="cursor:w-resize"' : '') + '></td><td id="popupWindowMiddle' + id + '"><div id="popupWindowCenter' + id + '" style="border:' + borderWidth + 'px solid ' + options.borderColor + ';background-color:' + options.color + ';border-radius:' + options.borderRadius + 'px;-webkit-box-shadow:0 1px ' + ring + 'px rgba(0,0,0,' + borderShadowOpacity + ');box-shadow:0 1px ' + ring + 'px rgba(0,0,0,' + borderShadowOpacity + ');font-size:12px;font-family:Verdana,Geneva,Tahoma,sans-serif;overflow:hidden;"><table cellpadding="0" cellspacing="0" style="width:100%;height:100%" border="0"><tr><td style="height:' + titleHeight + 'px;border-style:none none solid none;border-width:1px;border-color:#999999;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr>');
        options.zoomButton && htmlpage.push('<td id="popupWindowShow' + id + '" style="padding:' + imagepadding + 'px;cursor:pointer;width:' + imagewidth + 'px;" align="center" valign="middle"><img id="popupWindowShowControl' + id + '" alt="" style="display:block" src="images/arrow/1' + (options.expand ? '0' : '1') + '.gif" /></td>');
        htmlpage.push('<td id="popupWindowTitle' + id + '" style="cursor:default;text-align:center;vertical-align:middle;white-space:nowrap;overflow:hidden;"></td><td id="popupWindowClose' + id + '" style="padding:' + imagepadding + 'px;cursor:pointer;width:' + imagewidth + 'px;height:' + imageheight + 'px;"><img alt="" src="' + options.closeImage + '" style="display:block"/></td></tr></table></td></tr><tr><td style="vertical-align:top;padding:' + padding + 'px;background-color:#dfdfdf;"><div id="popupWindowHtml' + id + '" style="overflow:auto;-webkit-overflow-scrolling:touch;"></div></td></tr></table></div></td><td id="popupWindowRight' + id + '"' + (options.draggable ? ' style="cursor:e-resize"' : '') + '></td></tr>');
        htmlpage.push('<tr style="height:' + ring + 'px"><td id="popupWindowLeftBottom' + id + '"' + (options.draggable ? ' style="cursor:sw-resize"' : '') + '></td><td id="popupWindowBottom' + id + '"' + (options.draggable ? ' style="cursor:s-resize"' : '') + '></td><td id="popupWindowRightBottom' + id + '"' + (options.draggable ? ' style="cursor:se-resize"' : '') + '></td></tr>');
        htmlpage.push('</table>');
        return self._dom(htmlpage.join(""));
    }
    ,
    _dom: function (htmlstring) {
        var node
            , div = document.createElement("div")
            , fragment = document.createDocumentFragment(); 
        div.innerHTML = htmlstring;
        while ((node = div.firstChild))
            fragment.appendChild(node);
        return fragment;
    }
    ,
    _fadeOut: function (DIV, callback, context) {
        var style, opacity;
        if (DIV) {
            style = DIV.style;
            opacity = parseFloat(style.opacity);
        } else {
            style = null;
            opacity = 0;
        }
        (function () {
            if (opacity > 0) {
                opacity = Math.max((opacity -= 0.1), 0);
                if (style) {
                    style.filter = 'alpha(opacity=' + (opacity * 100) + ')'; //ie
                    style.opacity = opacity; //非ie
                }
                setTimeout(arguments.callee, 50);
            } else
                (typeof callback === "function") && callback.call(context);
        })();
    }
    ,
    close: function () {
        var self = this;
        var options = self.options;
        if (self.open) {
            self.open = false;
            if (options.draggable) {
                self.Title_draggable.disable();
                self.Title_draggable = null;

                var DragEvent = self.DragEvent;

                self.RightBottom_draggable.off(DragEvent, self);
                self.RightBottom_draggable.disable();

                self.Bottom_draggable.off(DragEvent, self);
                self.Bottom_draggable.disable();

                self.Right_draggable.off(DragEvent, self);
                self.Right_draggable.disable();

                self.LeftTop_draggable.off(DragEvent, self);
                self.LeftTop_draggable.disable();

                self.Top_draggable.off(DragEvent, self);
                self.Top_draggable.disable();

                self.RightTop_draggable.off(DragEvent, self);
                self.RightTop_draggable.disable();

                self.Left_draggable.off(DragEvent, self);
                self.Left_draggable.disable();

                self.LeftBottom_draggable.off(DragEvent, self);
                self.LeftBottom_draggable.disable();
            }
            L.DomEvent.off(self.Close, "click", self.close, self);
            options.model && L.DomEvent.off(self.Mask, "click", self.close, self);
            self.Show && L.DomEvent.off(self.Show, "click", self._show, self);

            //self.Popup.style.display = 'none';
            self.Popup.parentNode.removeChild(self.Popup);

            self._fadeOut(self.Mask, function () {
                var self = this;
                self.Title.innerHTML = self.Html.innerHTML = null;
                if (self.options.model) {
                    //self.Mask.style.display = 'none';
                    self.Mask.parentNode.removeChild(self.Mask);
                }
                self.fire('close');
            }, self);
        }
    }
});
