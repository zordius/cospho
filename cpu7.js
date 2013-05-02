YUI().use('node-base', 'node-style', 'node-screen', 'cookie', 'dump', 'event-key', 'event-focus', 'node-event-delegate', 'selector-css3', 'get', function (Y) {
    var NOW = Y.Cookie.get('n'),
        crumb = Y.Cookie.get('r'),
        ERR = Y.Cookie.get('e'),
        id = Y.Cookie.get('i'),
        mob = Y.Cookie.get('m'),
        mobOn = (mob === '2') || ((mob !== '1') && (Y.UA.iphone || screen.width < 500)),

        keys = ['f', 'p', 'n', 'l'],
        pn = {P: 112, N: 110},
        rk = [],
        noh = 0,

        I, J, K, L,

        FBdata = {
            accessToken: null
        },

        body = Y.one('body'),
        m = Y.one('.main .event .map div'),
        h = Y.one('html'),
        ci = Y.one('#captchaimg'),
        po = Y.one('.main .ephoto li.cur'),
        ptb = Y.one('button.ptoolb'),
        pg = Y.all('div.ft .pg'),

        moff = Y.all('div.main div.mod.mod_off'),
        cur = Y.one('div.side .titles li.cur'),
        mup = Y.one('div.mod.pup .mup div'),
        cladm = Y.one('div.admin span.close'),
        fbclr = Y.one('div.fbclr'),

        reloadCaptcha = function () {
            if (ci) {
                ci.setStyle('backgroundImage', ['url(http://image.captchas.net/?client=zordius&height=100&random=', crumb, ')'].join(''));
            }
        },

        checkFormRequire = function (F) {
            var req = 0;
            F.all('label.req').each(function (O) {
                var I = F.one('#' + O.get('for'));
                if (((I.get('type') !== 'checkbox') && I.get('value')) || I.get('checked')) {
                    I.removeClass('empty');
                    O.removeClass('isreq');
                } else {
                    if (! req) {
                        I.focus();
                    }
                    req++;
                    I.addClass('empty');
                    O.addClass('isreq');
                }
            });
            if (req) {
                F.addClass('req');
            }
            return req;
        },

        handleFBLogin = function (R) {
            if (R.authResponse && R.authResponse.accessToken) {
                FBdata.accessToken = R.authResponse.accessToken;
                return;
                FB.api('/cospho/posts', {
                    accessToken: FBdata.accessToken
                }, function (R) {
                });
            }
        },

        clearUp = function () {
            body.empty(true);
            YUI.Env.remove(window, 'unload', clearUp);
        },

        sob = 0,
        ephoto = ptb ? Y.one('.main .ephoto') : 0,
        ephotoDown = function (E) {
            sob = E.currentTarget.get('parentNode').one('input');
            E.preventDefault();
        },
        ephotoUp = function (E) {
            var eob = E.currentTarget.get('parentNode').one('input'),
                tri = 0;
            E.preventDefault();
            ephoto.all('li input').each(function (O) {
                if ((O === eob) || (O === sob)) {
                    O.getDOMNode().click();
                    if (sob !== eob) {
                        tri++;
                    }
                } else if (tri === 1) {
                    O.getDOMNode().click();
                }
            });
        },
        noDefault = function (E) {
            E.preventDefault();
        };

    // handle leak
    YUI.Env.add(window, 'unload', clearUp);

    // body class
    body.addClass('yui3-skin-sam');
    if (window.self !== window.top) {
        body.addClass('iframe');
    }
    if (id) {
        body.addClass('log').toggleClass('owner', window.DATA.owner === id);
    }

    // Login/logout module
    if (! location.href.match(/\=login/)) {
        Y.one('#srh .ft span').setContent(id ? '歡迎回來，<a href="?u=user&d=' + id + '">' + id + '</a>。<a href="?u=logout" class="logout">登出</a>' : '<a href="?u=login" class="login">登入 | 新註冊</a>');
    }

    // js loading css, iframe auto height
    if (window.CSS) {
        window.CSS.pop();
        Y.Get.css(window.CSS, (window.self !== window.top) ? {onSuccess: function () {
            var setHeight = function () {
                setTimeout(function () {
                    var H = document.getElementById('doc2').offsetHeight;
                    if (H) {
                        window.parent.document.getElementById(window.self.name).style.height = H + 'px';
                    } else {
                        setHeight();
                    }
                }, 100);
            };
            setHeight();
        }} : null);
    }

    // Module on/off
    Y.one('div.main').delegate('click', function (E) {
        E.currentTarget.ancestor('.mod_on').toggleClass('mod_off');
    }, 'div.mod_on div.hd, div.mod_on div.ft');

    // handle captcha
    reloadCaptcha();

    // reopen module when error
    if (ERR) {
        if (moff) {
            moff.removeClass('mod_off');
            reloadCaptcha();
        }
        if (! Y.one('.error .ft a')) {
            Y.Cookie.set('e', '');
        }
    }

    // mobile mode
    h.toggleClass('mobile', mobOn);
    if (mobOn && (screen.width > 485 || screen.height > 485)) {
        h.addClass('pad');
    }

    // init event map when click
    if ((! mobOn) && m) {
        I = m.get('parentNode');

        m.on('click', function (E) {
            this.get('parentNode').get('parentNode').addClass('map_exp');
        });

        I.append('<iframe frameborder="0" scrolling="no" src="' + I.one('a').get('href') + '&output=embed"></iframe>').appendChild('<b></b>').on('click', function (E) {
            this.get('parentNode').get('parentNode').removeClass('map_exp');
        });
    }

    // check form requirement
    Y.all('form').on('submit', function (E) {
        var F = E.currentTarget;

        if (checkFormRequire(F)) {
            E.preventDefault();
            var S = F.one('input.submit'),
                V = S.get('value');
            if ((S.get('offsetWidth') > 150) && ! V.match(/必填/)) {
                S.set('value', V + ' [缺必填欄位]');
            }
        }

    });

    // mobile version switch
    Y.all('#ft .versions a').on('click', function (E) {
        Y.Cookie.set('m', E.currentTarget.hasClass('mobile') ? 2 : 1);
        E.preventDefault();
        location.reload();
    });

    // fix button submit for IE
    if ((Y.UA.ie > 0) && (Y.UA.ie < 8)) {
        Y.all('form button[type=submit]').on('click', function (E) {
            var S = E.currentTarget,
                V = S.get('tag'),
                N = S.get('name'),
                F = S.get('form');

            F.all('button[type=submit]').set('name', '');
            S.set('name', N);
            S.set('value', V);
            S.setStyle('opacity', 0);
        });
    }

    // regist hotkey for pagenation
    for (I = 0;I < keys.length;I++) {
        J = keys[I];
        K = Y.one('div.pg a.' + J);
        if (K) {
            K.set('title', '熱鍵 ' + J.toUpperCase());
            rk[J.charCodeAt()] = K;
        }
    }

    // auto click to prev/next photo
    if (po) {
        var I = po.next('li'),
            J = po.previous('li'),
            K = Y.one('.ephoto .bk a'),
            L = Y.one('.main .photo .bd'),
            M = L.one('.img');

        if (L && M) {
            if (J) {
                rk[112] = M.appendChild('<a class="p" title="上一張照片(熱鍵 P)" href="' + J.one('a').get('href') + '"><i></i></a>');
            }
            if (I) {
                rk[110] = M.appendChild('<a class="n" title="下一張照片(熱鍵 N)" href="' + I.one('a').get('href') + '"><i></i></a>');
            }
            if (K) {
                K.set('title', '熱鍵 Z');
                rk[122] = K;
            }
            L.append('<a class="dl" href="' + L.one('img').get('src') + '" target="_blank">下載</a>');
        }
    }

    // auto hotkey to prev/next thread
    if (cur) {
        I = cur.previous('li');
        if (I) {
            rk[112] = I.one('a').set('title', '(熱鍵 P)');
        }
        I = cur.next('li');
        if (I) {
            rk[110] = I.one('a').set('title', '(熱鍵 N)');
        }
    } else {
        // auto hotkey to prev/next event photo
        for (I in pn) {
            J = Y.one('.p_ephotou .ephotol i.' + I.toLowerCase());
            if (J) {
                rk[pn[I]] = J.next('a').set('title', '(熱鍵 ' + I + ')');
            }
        }
    }

    // regist accesskeys as hotkey
    Y.all('button[accesskey]').each(function (O) {
        var K = O.getAttribute('accesskey');
        O.setAttribute('accesskey', '');
        O.set('title', O.get('title') + '(熱鍵 ' + K.toUpperCase() + ')');
        rk[K.charCodeAt()] = O;
    });

    // admin functions
    if (Y.Cookie.get('adm') === '1') {
        body.addClass('adm');
        I = Y.one('div.adm_db');
        if (I) {
            I.delegate('click', function (E) {
                E.currentTarget.get('parentNode').toggleClass('on');
            }, 'li h2');
        }
    }

    // photo menu
    if (ptb) {
        ptb.on('click', function (E) {
            body.addClass('pmenu');
            ephoto.delegate('click', noDefault, 'li a');
            ephoto.delegate('mousedown', ephotoDown, 'li a');
            ephoto.delegate('mouseup', ephotoUp, 'li a');
        });
        Y.one('button.ptoolc').on('click', function (E) {
            body.removeClass('pmenu');
            ephoto.detach('click');
            ephoto.detach('mousedown');
            ephoto.detach('mouseup');
        });
        ptb.get('form').on('submit', function (E) {
            var ok = 0;
            E.currentTarget.all('input').each(function (O) {
                if (O.get('checked')) {
                    ok = 1;
                }
            });
            if (!ok) {
                window.alert('請至少選擇一張照片再進行此動作。');
                E.preventDefault();
            }
        });
    }

    // page nav quick slider
    if ((! mobOn) && pg) {
        pg.each(function (O) {
            var vsi = O.one('i'),
                u = O.one('a.f').get('href'),
                vsv = vsi.getContent().split('/'),
                updatePG = function (E) {
                    var vx = Math.round(vsi.getX()),
                        vw = vsi.get('offsetWidth') - 1,
                        p = Math.floor((vsv[1] - 1) * (E.pageX - vx) / vw);

                    vsi.setContent([1 + p, vsv[1]].join('/'));
                    return p;
                };

            vsi.addClass('vsi', 'block');

            vsi.on('click', function (E) {
                vsv[0] = updatePG(E);
                location.href = u.replace(/p=0/, 'p=' + vsv[0]);
                vsi.detach('mousemove');
                vsi.addClass('go');
            });

            vsi.on('mouseover', function (E) {
                vsi.addClass('on');
            });

            vsi.on('mouseout', function (E) {
                vsi.removeClass('on');
                vsi.setContent(vsv.join('/'));
            });

            vsi.on('mousemove', updatePG);
        });
    }

    // disable hotkey when text input
    body.on('focus', function (E) {
        noh = E.target.test('textarea, input[type=text]');
    });
    body.on('blur', function (E) {
        noh = 0;
    });

    // handle hotkeys
    Y.on('keypress', function (E) {
        var O = rk[E.charCode];

        if (noh || E.altKey || E.ctrlKey || E.shiftKey || E.metaKey) {
            return;
        }

        if (O) {
            if (O.test('button')) {
                if (O.getX()) {
                    O.getDOMNode().click();
                }
            } else {
                location.href = O.get('href');
            }
        }
    }, Y.UA.ie ? body : undefined);

    // close admin bar
    if (cladm) {
        cladm.on('click', function (E) {
            E.preventDefault();
            Y.one('div.admin').hide();
        });
    }

    // QR code ... todo
    // http://chart.apis.google.com/chart?chs=300x300&chl=http%3A%2F%2Fblog.pixnet.net%2F&choe=UTF-8&cht=qr

    // facebook clean
    if (fbclr) {
        fbclr.delegate('click', function (E) {
            var O = E.currentTarget,
                id = O.get('title');

            O.set('href', 'http://www.facebook.com/dialog/oauth/?client_id=' + id + '&redirect_uri=https://www.facebook.com/connect/login_success.html%3Fid=' + id + '&response_type=token');
        }, 'li a');
    }

    // facebook api
    if ((!mobOn) && window.DATA.FB && (Y.UA.ie !== 6)) {
        body.append('<div id="fb-root"></div>');
        Y.Get.js('http://connect.facebook.net/zh_TW/all.js', function (err) {
            body.addClass('fbon');
            FB.init({appId: '139987569375092', channelUrl: '//cospho.dyndns.info/?u=fbchannel', xfbml: true});
            if (window.self !== window.top) {
                FB.Canvas.setAutoGrow(1000);
            }
            FB.getLoginStatus(handleFBLogin);
        });
    }
});
