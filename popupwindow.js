/* PopupWindowClass 弹出式窗口类，需要leaflet提供的L.Class、L.Draggable类支持

主要特点：
    1、支持模式和非模式两种窗口形态
    2、支持标题栏拖放平移和双击极大化，支持边角和边框缩放
    3、支持定时驻留和淡出
    4、支持iframe嵌入

用法：var openPopupWindow = new PopupWindowClass("标题栏文本", 'HTML内容', {选项对象});
其中，选项对象包括：
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
    3、窗口最大化和最小化时，触发：zoomIn和zoomOut事件
    4、窗口缩放平移后，触发：Right Bottom RightBottom LeftBottom RightTop Left Top LeftTop Move事件，并携带宽度和高度对象

用法举例：
    1、设置窗口的宽度和高度分别为160和90像素，驻留5秒后自动关闭，屏蔽层的透明度为0，不显示缩放箭头，关闭边框的缩放功能，然后响应关闭事件
        var openPopupWindow = new PopupWindowClass("标题栏文本", 'HTML内容', { width: 160, height: 90, age: 5000, maskColor: "#ffffff", maskOpacity: 0, zoomButton: false, draggable:false});
        openPopupWindow.once("close", function() {alert("窗口刚关闭!")}, this);
    2、显示一个微小的等待效果
        var openPopupWindow = new PopupWindowClass(null, null, { width: 0, height: 0, maskColor: "white", maskOpacity: 100, zoomButton: false, draggable: false, expand: false, closeImage: 'images/waiting.gif', borderShadowOpacity: 0, borderColor: 'white', color: 'white' });
    3、简易用法
        var openPopupWindow = new PopupWindowClass("Welcome", 'Hello World!');
*/

//特别注意：leaflet0.7.7版的L.DomUtil.getPosition函数未考虑边界效应，这里暂直接采用1.0版的替代之。同时注意，必须先嵌入leaflet.js，然后再嵌入本脚本！
L.DomUtil.getPosition = function (el) {
    // 下行是0.7.7版
    //return el._leaflet_pos; 
    // 下行是1.0版
    return el._leaflet_pos || new L.Point(0, 0);
};

var PopupWindowClass = L.Class.extend({

    //0.7.7采用下行，1.0.0不需要！
    includes: L.Mixin.Events, 

    statics: {
        zIndex: 12345 //基于本类产生的若干对象中，首次创建的对象的最底层序编号
    },

    options: {
        zIndex: null, //窗口的层序控制因子，数字越大越处于顶层！该值将影响类静态成员zIndex的值，默认值：12345
        model: true, //是否按模式（被覆盖的层不响应任何交互操作）窗口进行渲染，默认为真（模式）
        top: null, //窗口左上角距离父级顶部的纵向像素偏移量，默认或忽略时自动以中央位置计算偏移量
        left: null, //窗口左上角距离父级左边缘横向像素偏移量，默认或忽略时自动以中央位置计算偏移量
        width: null, //版心像素宽度，省略时取默认值：自动按主窗口宽度的50%设置
        height: null, //版心像素高度，省略时取默认值：自动按主窗口高度的50%设置
        padding: 2, //实际内容距离窗口边框多少个像素，默认值：2个像素，需大于等于0
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
        full: false, //初始化时是否充满容器，默认不充满
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
        var id = self.id = '_' + L.stamp(self);
        options = L.setOptions(self, options);
        self.full = options.full;

        //初始化界面html元素
        document.body.appendChild(self._frame());

        //创建界面各组件的dom对象
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

        if (options.zoomButton)
            self.ShowControl = $("popupWindowShowControl" + id);

        var popupWindowShow = self.Show = options.zoomButton ? $("popupWindowShow" + id) : null;
        var popupWindowTitle = self.Title = $("popupWindowTitle" + id);
        var popupWindowClose = self.Close = $("popupWindowClose" + id);
        var popupWindowHtml = self.Html = $("popupWindowHtml" + id); //版心容器dom
        var popupWindowRight = self.Right = $("popupWindowRight" + id);

        var popupWindowLeftBottom = self.LeftBottom = $("popupWindowLeftBottom" + id);
        var popupWindowBottom = self.Bottom = $("popupWindowBottom" + id);
        var popupWindowRightBottom = self.RightBottom = $("popupWindowRightBottom" + id);

        //设置并得到窗口和版心的位置和尺寸
        var size = self._size();

        //标题内容
        title && (popupWindowTitle.innerHTML = title);
        //版心内容
        content && (popupWindowHtml.innerHTML = content);

        popupWindow.style.display = 'block';
        options.model && (popupWindowMask.style.display = 'block');

        self.options.expand = !self.options.expand;
        self._show();

        L.DomEvent.on(popupWindowClose, "click", self.close, self);
        options.model && L.DomEvent.on(popupWindowMask, "click", self.close, self);
        popupWindowShow && L.DomEvent.on(popupWindowShow, "click", self._show, self);

        if (options.draggable) {
            L.DomEvent.on(window, 'resize', self._onResize, self);
            self.Title_draggable = new L.Draggable
            (
                popupWindow,
                popupWindowTitle 
            );

            self.LeftBottom_draggable = new L.Draggable
            (
                popupWindowLeftBottom 
            );

            self.Left_draggable = new L.Draggable
            (
                popupWindowLeft 
            );

            self.LeftTop_draggable = new L.Draggable
            (
                popupWindowLeftTop 
            );

            self.Top_draggable = new L.Draggable
            (
                popupWindowTop 
            );

            self.RightTop_draggable = new L.Draggable
            (
                popupWindowRightTop 
            );

            self.Right_draggable = new L.Draggable
            (
                popupWindowRight 
            );

            self.Bottom_draggable = new L.Draggable
            (
                popupWindowBottom 
            );

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
                    this.fire('drag', e);
                };

            var DragEvent = self.DragEvent = {
                'dragstart': this._onDragStart,
                'drag': this._onDrag
            };

            //注意：首次拖拉时在ie9及其以下版本体验有瞬间错位现象
            self.Title_draggable.on(DragEvent, self);
            self.Title_draggable.enable();

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

            L.DomEvent.on(popupWindowTitle, "click", self.onDblclick, self);
        }

        self.open = true;
        if (options.age > 0)
            setTimeout(L.bind(self.close, self), options.age);

        self.fire('open', size);
    }
    ,
    _size: function () {
        //依据窗口的top和left属性 以及 版心的width和height属性 渲染窗口
        var self = this;
        var options = self.options;

        //获取浏览器窗口尺寸
        var screenSize = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };

        var titleHeight = options.titleHeight;
        var ring = options.borderShadowRing * 1;
        var padding = options.padding * 1;
        var borderWidth = options.borderWidth * 1;

        var isFull = self.full;

        var popupWindow = self.Popup;
        var style = popupWindow.style;

        //根据版心宽度计算窗口总宽度
        var width;
        if (isFull) {
            style.transform = null; //注意：transform属性是leaflet的扩展，形如：transform: translate(501px, 66px)
            options.width =
                (width = screenSize.width)
                - ring //左阴影宽
                - borderWidth //左边框宽
                - padding //左padding宽
                - padding //右padding
                - borderWidth //右边框宽
                - ring; //右阴影宽
        } else {
            width = options.width;
            width = Math.max(
            (
                (options.width = (width == null || width < 0 ? screenSize.width * 0.5 : parseInt(width)))
                    + ring //左阴影宽
                    + borderWidth //左边框宽
                    + padding //左padding宽
                    + padding //右padding
                    + borderWidth //右边框宽
                    + ring //右阴影宽
            ), options.closeImageSize.width * (options.zoomButton ? 2 : 1) + ring + borderWidth + padding + padding + borderWidth + ring);
        }
        //根据版心高度计算窗口总高度
        var height;
        if (isFull) {
            options.height =
                (height = screenSize.height)
                - ring //顶部阴影高
                - borderWidth //上边框高
                - titleHeight //标题栏高
                - 1 //标题栏下边框高
                - padding //上padding高
                - padding //下padding高
                - borderWidth //下边框高
                - ring; //底部阴影高
        } else {
            height = options.height;
            height =
                (options.height = (height == null || height < 0 ? screenSize.height * 0.5 : parseInt(height)))
                + ring //顶部阴影高
                + borderWidth //上边框高
                + titleHeight //标题栏高
                + 1 //标题栏下边框高
                + padding //上padding高
                + padding //下padding高
                + borderWidth //下边框高
                + ring; //底部阴影高
        }

        //设置版心的高度
        var popupWindowHtml = self.Html;
        popupWindowHtml.style.height = options.height + "px";

        //设置版心的宽度
        popupWindowHtml.style.width = options.width + "px";

        //设置窗口的展现位置和尺寸
        style.top = (options.top = (isFull ? 0 : (options.top === null ? (screenSize.height - height) / 2 : parseInt(options.top)))) + "px";
        style.left = (options.left = (isFull ? 0 : (options.left === null ? (screenSize.width - width) / 2 : parseInt(options.left)))) + "px";
        style.width = width + "px";
        style.height = height + "px";
        return { outer: { top: options.top, left: options.left, width: width, height: height }, inner: { width: options.width, height: options.height } };
    }
    ,
    _onResize: function () {
        var self = this;
        if (self.full) {
            if (self.__onResize)
                clearTimeout(self.__onResize);
            self.__onResize = setTimeout
            (
                L.bind
                (
                    function () {
                        var self = this;
                        self.__onResize = null;
                        self._size();
                    },
                    self
                ),
                10
            );
        }
    }
    ,
    onDblclick: function (e) {
        L.DomEvent.stop(e);
        var self = this;
        if (self.__onDblclick) {
            clearTimeout(self.__onDblclick);
            self.__onDblclick = null;
            var options = self.options;
            var style = self.Popup.style;
            if (self.full) {
                self.full = false;
                options.top = self.top;
                options.left = self.left;
                options.width = self.width;
                options.height = self.height;
                style.transform = self.transform;
            } else {
                self.full = true;
                self.top = options.top;
                self.left = options.left;
                self.width = options.width;
                self.height = options.height;
                self.transform = style.transform;
            }
            self._size();
        } else
            self.__onDblclick = setTimeout(L.bind(function() {
                var self = this;
                self.__onDblclick = null;
            }, self), 250);
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
            options.height + 2 * padding + 1
            :
            0
        ) + (titleHeight + ring + borderWidth + ring + borderWidth) + "px";
        self.Show && (self.ShowControl.src = "images/arrow/1" + (expand ? "0" : "1") + ".gif" );
        self.fire('zoom' + (expand ? 'In' : 'Out'));
    }
    ,
    _onDragStart: function (e) {
        this._oldPos = e.target._newPos;
    }
    ,
    _onDrag: function (e) {
        var self = this;
        var options = self.options;
        if (options.expand) {
            var _newPos = e.target._newPos;
            var titleDrag = self.full = false;
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
                        TopLeft(1);
                    break;
                case "RightTop":
                    height -= xy.y;
                    width += xy.x;
                    if (width > 0 && height > 0)
                        TopLeft(0);
                    break;
                case "Left":
                    width -= xy.x;
                    if (width > 0)
                        TopLeft(1);
                    break;
                case "Top":
                    height -= xy.y;
                    if (height > 0)
                        TopLeft(0);
                    break;
                case "LeftTop":
                    height -= xy.y;
                    width -= xy.x;
                    if (width > 0 && height > 0)
                        TopLeft(2);
                    break;
                default: //"" 标题栏
                    titleDrag = true;
                    options.top = parseInt(popupWindowstyle.top);
                    options.left = parseInt(popupWindowstyle.left);
                    break;
            }

            function TopLeft(top2left) {
                (top2left !== 1) && (popupWindowstyle.top = (options.top = (parseInt(popupWindowstyle.top) + xy.y)) + "px");
                (top2left !== 0) && (popupWindowstyle.left = (options.left = (parseInt(popupWindowstyle.left) + xy.x)) + "px");
            }

            if (!titleDrag) {
                if (width > 0 && height > 0) {
                    var ring = options.borderShadowRing * 1;
                    var padding = options.padding * 1;
                    var borderWidth = options.borderWidth * 1;
                    popupWindowstyle.height = height + "px";
                    popupWindowstyle.width = width + "px";
                    self.Html.style.width = (options.width = width - ring - borderWidth - padding - padding - borderWidth - ring) + "px";
                    self.Html.style.height = (options.height = height - ring - borderWidth - options.titleHeight - 1 - padding - padding - borderWidth - ring) + "px";
                    self._oldPos = _newPos;
                    self.fire(bounder, { width: options.width, height: options.height });
                }
            } else
                self.fire("Move", { top: options.top, left: options.left });
        }
    }
    ,
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
        //窗口容器将按是否为模式窗口创建div，若为模式窗口，便创建两个div，一个是实际的交互窗口：popupWindow；另一个是充当屏蔽膜的半透明盖层：popupWindowMask；若不是模式窗口，仅创建主窗口div，不再创建屏蔽层div
        options.model && htmlpage.push('<div id="popupWindowMask'
            + id
            + '" style="display:none;position:absolute;top:0%;left:0%;width:100%;height:100%;background-color:'
            + options.maskColor
            + ';z-index:'
            + (PopupWindowClass.zIndex++)
            + ';-moz-opacity:'
            + maskOpacity * 0.01
            + ';opacity:'
            + maskOpacity * 0.01
            + ';-webkit-filter:alpha(opacity='
            + maskOpacity
            + ');-moz-filter:alpha(opacity='
            + maskOpacity
            + ');-o-filter:alpha(opacity='
            + maskOpacity
            + ');filter:alpha(opacity='
            + maskOpacity + ');"></div>');

        htmlpage.push('<table id="popupWindow'
            + id
            + '" cellpadding="0" cellspacing="0" border="0" style="display:none;position:absolute;z-index:'
            + (PopupWindowClass.zIndex++)
            + ';overflow:hidden;">');
        htmlpage.push('<tr style="height:'
            + ring
            + 'px"><td id="popupWindowLeftTop'
            + id
            + '" style="width:'
            + ring
            + 'px;'
            + (options.draggable ? 'cursor:nw-resize;' : '')
            + '"></td><td id="popupWindowTop'
            + id
            + '"'
            + (options.draggable ? ' style="cursor:n-resize"' : '')
            + '></td><td id="popupWindowRightTop'
            + id
            + '" style="width:'
            + ring
            + 'px;'
            + (options.draggable ? 'cursor:ne-resize;' : '')
            + '"></td></tr>');
        htmlpage.push('<tr><td id="popupWindowLeft'
            + id
            + '"'
            + (options.draggable ? ' style="cursor:w-resize"' : '')
            + '></td><td id="popupWindowMiddle'
            + id
            + '"><div id="popupWindowCenter'
            + id
            + '" style="border:'
            + borderWidth
            + 'px solid '
            + options.borderColor
            + ';background-color:'
            + options.color
            + ';border-radius:'
            + options.borderRadius
            + 'px;-webkit-box-shadow:0 1px '
            + ring
            + 'px rgba(0,0,0,'
            + borderShadowOpacity
            + ');box-shadow:0 1px '
            + ring
            + 'px rgba(0,0,0,'
            + borderShadowOpacity
            + ');font-size:12px;font-family:Verdana,Geneva,Tahoma,sans-serif;overflow:hidden;"><table cellpadding="0" cellspacing="0" style="width:100%;height:100%" border="0"><tr><td style="height:'
            + titleHeight
            + 'px;border-style:none none solid none;border-width:1px;border-color:#999999;"><table cellpadding="0" cellspacing="0" style="width:100%;"><tr>');
        options.zoomButton && htmlpage.push('<td id="popupWindowShow'
            + id
            + '" style="padding:'
            + imagepadding
            + 'px;cursor:pointer;width:'
            + imagewidth
            + 'px;" align="center" valign="middle"><img id="popupWindowShowControl'
            + id
            + '" alt="" style="display:block" src="images/arrow/1'
            + (options.expand ? '0' : '1')
            + '.gif" /></td>');
        htmlpage.push('<td id="popupWindowTitle'
            + id
            + '" style="cursor:default;text-align:center;vertical-align:middle;white-space:nowrap;overflow:hidden;"></td><td id="popupWindowClose'
            + id
            + '" style="padding:'
            + imagepadding
            + 'px;cursor:pointer;width:'
            + imagewidth
            + 'px;height:'
            + imageheight
            + 'px;"><img alt="" src="'
            + options.closeImage
            + '" style="display:block"/></td></tr></table></td></tr><tr><td style="vertical-align:top;padding:'
            + padding
            + 'px;background-color:#dfdfdf;"><div id="popupWindowHtml'
            + id
            + '" style="overflow:auto;-webkit-overflow-scrolling:touch;"></div></td></tr></table></div></td><td id="popupWindowRight'
            + id
            + '"'
            + (options.draggable ? ' style="cursor:e-resize"' : '')
            + '></td></tr>');
        htmlpage.push('<tr style="height:'
            + ring
            + 'px"><td id="popupWindowLeftBottom'
            + id
            + '"'
            + (options.draggable ? ' style="cursor:sw-resize"' : '')
            + '></td><td id="popupWindowBottom'
            + id
            + '"'
            + (options.draggable ? ' style="cursor:s-resize"' : '')
            + '></td><td id="popupWindowRightBottom'
            + id
            + '"'
            + (options.draggable ? ' style="cursor:se-resize"' : '')
            + '></td></tr>');
        htmlpage.push('</table>');

        var div = document.createElement("div");
        div.innerHTML = htmlpage.join("");
        var node;
        htmlpage = document.createDocumentFragment();
        while ((node = div.firstChild))
            htmlpage.appendChild(node);
        return htmlpage;
    }
    ,
    _fadeOut: function (DIV, callback, context) {
        var style = DIV ? DIV.style : null;
        var opacity = DIV ? parseFloat(style.opacity) : 0;
        (function () {
            if (opacity > 0) {
                opacity = Math.max((opacity -= 0.1), 0);
                if (style)
                    style.filter = 'alpha(opacity=' + ((style.opacity = opacity) * 100) + ')';
                setTimeout(arguments.callee, 50);
            } else 
                (typeof callback === "function") && callback.call(context);
        })();
    }
    ,
    close: function () {
        //关闭窗口
        var self = this;
        var options = self.options;
        if (self.open) {
            if (options.draggable) {
                L.DomEvent.off(window, 'resize', self._onResize, self);

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

                L.DomEvent.off(self.Title, "click", self.onDblclick, self);
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
