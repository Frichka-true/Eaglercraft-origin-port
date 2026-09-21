// Origin ver 0.5
(function () {
    'use strict';

    var cheatState = {
        flyEnabled: false, flyApplied: false,
        antikbEnabled: false, lastGoodMotion: null,
        lastFlySpeedSent: -1,
        slowEnabled: false, slowFactor: 0.85, lastSlowAtTick: 0,
        climbEnabled: false, lastClimbAtTick: 0,
        waterSpeedEnabled: false, waterJumpEnabled: false
    };
    var tickCounter = 0;
    var gammaState = { applied: false, saved: null };
    var lastForeverTick = {};

    var wasInWorld = false;

    function getMc() { return ModAPI.mc || ModAPI.javaClient || null; }
    function getPlayer() { var mc = getMc(); return mc ? mc.thePlayer : null; }

    function safeNumber(v) {
        if (v == null) return 0;
        if (typeof v === 'symbol') return 0;
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        if (typeof v === 'bigint') return Number(v);
        if (typeof v === 'boolean') return v ? 1 : 0;
        try { var n = Number(v); return isFinite(n) ? n : 0; } catch(e) { return 0; }
    }

    function nameOf(p) {
        if (!p) return null;
        try {
            var gp = p.gameProfile;
            if (gp) {
                if (gp.$name3) { try { var s = ModAPI.util.ustr(gp.$name3); if (s) return String(s); } catch(e){} }
                if (gp.$name)  { try { var s2 = ModAPI.util.ustr(gp.$name);  if (s2) return String(s2); } catch(e){} }
                if (gp.name)   return String(gp.name);
            }
        } catch(e){}
        try { var n = p.getName(); if (n) { var ns = String(n); if (ns && ns !== '[object Object]') return ns; } } catch(e){}
        try { if (typeof p.username === 'string' && p.username) return p.username; } catch(e){}
        try { if (typeof location !== 'undefined' && /server/i.test(location.pathname)) return 'Host'; } catch(e){}
        return null;
    }

    function updateGamma(want) {
        var mc = getMc();
        if (!mc || !mc.gameSettings) return;
        if (want) {
            if (!gammaState.applied) {
                if (gammaState.saved === null) gammaState.saved = safeNumber(mc.gameSettings.gammaSetting);
                try { mc.gameSettings.gammaSetting = 100; } catch(e){}
                gammaState.applied = true;
            }
        } else if (gammaState.applied) {
            if (gammaState.saved !== null) { try { mc.gameSettings.gammaSetting = gammaState.saved; } catch(e){} }
            gammaState.saved = null;
            gammaState.applied = false;
        }
    }
    function computeGammaWant() {
        var p = getPlayer(); if (!p) return false;
        var origin = currentOrigin;
        if (ROLE === 'HOST') { var nm = nameOf(p); origin = originsByPlayer[nm] || currentOrigin; }
        if (!origin) return false;
        if (origin === 'feline') return true;
        if (origin === 'merling' || origin === 'turtle') return isInWater(p);
        return false;
    }

    var BlockPosCtor = null;
    var blockPosSearched = false;
    function findBlockPosCtor() {
        if (blockPosSearched) return BlockPosCtor;
        blockPosSearched = true;
        var cands = [
            ModAPI.items && ModAPI.items.BlockPos,
            ModAPI.blocks && ModAPI.blocks.BlockPos,
            ModAPI.util && ModAPI.util.BlockPos,
            ModAPI.util && ModAPI.util.BlockPosition
        ];
        for (var i = 0; i < cands.length; i++) {
            var c = cands[i]; if (!c) continue;
            if (typeof c === 'function') { BlockPosCtor = c; return c; }
            if (c.$class && typeof c.$class === 'function') { BlockPosCtor = c.$class; return c.$class; }
            if (c.$class && c.$class.$class) { BlockPosCtor = c.$class.$class; return c.$class.$class; }
        }
        return null;
    }
    function blockAt(world, x, y, z) {
        if (!world) return null;
        x = safeNumber(x); y = safeNumber(y); z = safeNumber(z);
        if (typeof world.getBlockState === 'function') {
            var ctor = findBlockPosCtor();
            if (ctor) {
                try { return world.getBlockState(new ctor(x, y, z)); } catch(e){}
            }
        }
        try { if (typeof world.getBlock === 'function') return world.getBlock(x, y, z); } catch(e){}
        try { if (typeof world.getBlockId === 'function') return { __id: safeNumber(world.getBlockId(x, y, z)) }; } catch(e){}
        return null;
    }
    function getBlockId(state) {
        if (!state) return -1;
        if (typeof state.__id === 'number') return state.__id;
        try {
            var b = state.getBlock ? state.getBlock() : null;
            if (!b) return -1;
            try { if (typeof b.getIdFromBlock === 'function') return safeNumber(b.getIdFromBlock(b)); } catch(e){}
            try { if (ModAPI.blocks && typeof ModAPI.blocks.getIdFromBlock === 'function') return safeNumber(ModAPI.blocks.getIdFromBlock(b)); } catch(e){}
            if (typeof b.blockID !== 'undefined') return safeNumber(b.blockID);
            if (typeof b.$blockID !== 'undefined') return safeNumber(b.$blockID);
            if (typeof b.id !== 'undefined') return safeNumber(b.id);
        } catch(e){}
        return -1;
    }
    function blockIsWater(state) {
        if (!state) return false;
        var id = getBlockId(state);
        if (id === 8 || id === 9) return true;
        try {
            var b = state.getBlock ? state.getBlock() : null;
            if (b) {
                if (typeof b.isLiquid === 'function' && b.isLiquid(state)) return true;
                try {
                    if (typeof state.getMaterial === 'function') {
                        var mat = state.getMaterial();
                        if (mat && typeof mat.isLiquid === 'function' && mat.isLiquid()) return true;
                    }
                } catch(e){}
                var un = null;
                try { if (typeof b.getUnlocalizedName === 'function') un = b.getUnlocalizedName(); } catch(e){}
                if (un && /water/i.test(String(un))) return true;
            }
        } catch(e){}
        return false;
    }
    function isInWater(p) {
        if (!p) return false;
        try { if (typeof p.isInWater === 'function') { var r = p.isInWater(); if (r === true || safeNumber(r) > 0) return true; } } catch(e){}
        try { if (typeof p.isWet === 'function') { var r2 = p.isWet(); if (r2 === true || safeNumber(r2) > 0) return true; } } catch(e){}
        try { if (safeNumber(p.inWater) > 0) return true; } catch(e){}
        try { if (safeNumber(p.$inWater) > 0) return true; } catch(e){}
        try { if (safeNumber(p.wet) > 0) return true; } catch(e){}
        try { if (safeNumber(p.$wet) > 0) return true; } catch(e){}
        var mc = getMc();
        var w = mc && mc.theWorld;
        if (!w) return false;
        var x = Math.floor(safeNumber(p.posX));
        var yBase = safeNumber(p.posY);
        var z = Math.floor(safeNumber(p.posZ));
        var positions = [
            [x, Math.floor(yBase + 0.1), z],
            [x, Math.floor(yBase - 0.5), z],
            [x, Math.floor(yBase + 0.9), z]
        ];
        for (var i = 0; i < positions.length; i++) {
            var pos = positions[i];
            var s = blockAt(w, pos[0], pos[1], pos[2]);
            if (s && blockIsWater(s)) return true;
        }
        return false;
    }
    function isUnderSky(p) {
        if (!p) return true;
        try {
            if (typeof p.getBrightness === 'function') {
                var b = safeNumber(p.getBrightness(1.0));
                if (b > 0) return b >= 0.8;
            }
        } catch(e){}
        try {
            if (typeof p.getBrightnessForRender === 'function') {
                var b2 = safeNumber(p.getBrightnessForRender(1.0));
                if (b2 > 0) return b2 >= 0.8;
            }
        } catch(e){}
        return true;
    }
    function getWorldTime(mc) {
        try {
            var w = mc && mc.theWorld;
            if (!w) return null;
            var raw = null;
            if (typeof w.getWorldTime === 'function') {
                try { raw = w.getWorldTime(); } catch(e){}
            }
            if (raw == null && typeof w.worldTime !== 'undefined') raw = w.worldTime;
            if (raw == null && typeof w.$worldTime !== 'undefined') raw = w.$worldTime;
            if (raw == null && typeof w.time !== 'undefined') raw = w.time;
            if (raw == null) return null;
            return safeNumber(raw);
        } catch(e){}
        return null;
    }
    function isDaytime(mc) {
        if (!mc) return true;
        var w = mc.theWorld;
        if (!w) return true;
        var t = getWorldTime(mc);
        if (t != null && isFinite(t) && t > 0) {
            var dt = ((t % 24000) + 24000) % 24000;
            return dt < 12000;
        }
        try {
            if (typeof w.getCelestialAngle === 'function') {
                var ang = safeNumber(w.getCelestialAngle(1.0));
                if (isFinite(ang) && ang >= 0) return ang > 0.25 && ang < 0.75;
            }
        } catch(e){}
        try {
            if (typeof w.isDaytime === 'function') {
                var r = w.isDaytime();
                if (typeof r === 'boolean') return r;
            }
        } catch(e){}
        try {
            var sl = safeNumber(w.skylightSubtracted);
            if (sl > 0) return sl < 4;
        } catch(e){}
        return true;
    }
    function isRaining(mc) {
        try { var w = mc && mc.theWorld; if (w && typeof w.isRaining === 'function') return !!w.isRaining(); } catch(e){}
        try {
            var w2 = mc && mc.theWorld;
            if (w2 && typeof w2.getRainStrength === 'function') return safeNumber(w2.getRainStrength(1)) > 0.5;
        } catch(e){}
        return false;
    }

    function updateFly() {
        var p = getPlayer();
        if (!p || !p.capabilities) return;
        if (cheatState.flyEnabled) {
            if (!p.capabilities.allowFlying || !p.capabilities.isFlying) {
                p.capabilities.allowFlying = true;
                p.capabilities.isFlying = true;
                try { if (p.sendPlayerAbilities) p.sendPlayerAbilities(); } catch(e){}
            }
            cheatState.flyApplied = true;
        } else if (cheatState.flyApplied) {
            p.capabilities.allowFlying = false;
            p.capabilities.isFlying = false;
            try { if (p.sendPlayerAbilities) p.sendPlayerAbilities(); } catch(e){}
            cheatState.flyApplied = false;
            cheatState.lastFlySpeedSent = -1;
        }
    }
    function updateFlySpeed(targetFly) {
        var p = getPlayer();
        if (!p || !p.capabilities || !cheatState.flyEnabled) return;
        if (safeNumber(p.capabilities.flySpeed) !== targetFly && cheatState.lastFlySpeedSent !== targetFly) {
            p.capabilities.flySpeed = targetFly;
            try { if (p.sendPlayerAbilities) p.sendPlayerAbilities(); } catch(e){}
            cheatState.lastFlySpeedSent = targetFly;
        }
    }
    function updateAntiKB() {
        var p = getPlayer(); if (!p) return;
        var hurt = safeNumber(p.hurtTime);
        if (cheatState.antikbEnabled) {
            if (hurt > 0) {
                if (cheatState.lastGoodMotion) { p.motionX = cheatState.lastGoodMotion.x; p.motionZ = cheatState.lastGoodMotion.z; }
                else { p.motionX = 0; p.motionZ = 0; }
            } else {
                cheatState.lastGoodMotion = { x: safeNumber(p.motionX), y: safeNumber(p.motionY), z: safeNumber(p.motionZ) };
            }
        } else {
            if (hurt === 0) cheatState.lastGoodMotion = { x: safeNumber(p.motionX), y: safeNumber(p.motionY), z: safeNumber(p.motionZ) };
        }
    }
    function updateSlow() {
        if (!cheatState.slowEnabled) return;
        if (tickCounter - cheatState.lastSlowAtTick < 1) return;
        cheatState.lastSlowAtTick = tickCounter;
        var mc = getMc(); if (mc && mc.currentScreen) return;
        var p = getPlayer(); if (!p) return;
        var mx = safeNumber(p.motionX), mz = safeNumber(p.motionZ);
        var mv2 = mx*mx + mz*mz;
        if (mv2 < 0.0001) return;
        p.motionX = mx * cheatState.slowFactor;
        p.motionZ = mz * cheatState.slowFactor;
    }
    function updateClimb() {
        if (!cheatState.climbEnabled) return;
        if (tickCounter - cheatState.lastClimbAtTick < 2) return;
        cheatState.lastClimbAtTick = tickCounter;
        var mc = getMc(); if (mc && mc.currentScreen) return;
        var p = getPlayer(); if (!p) return;
        var collided = false;
        try { collided = !!(p.isCollidedHorizontally || p.collidedHorizontally || p.$isCollidedHorizontally); } catch(e){}
        if (collided) { if (safeNumber(p.motionY) < 0.18) p.motionY = 0.18; }
    }
    function updateWaterSpeed() {
        if (!cheatState.waterSpeedEnabled) return;
        var mc = getMc(); if (mc && mc.currentScreen) return;
        var p = getPlayer(); if (!p) return;
        if (!isInWater(p)) return;
        var mx = safeNumber(p.motionX), mz = safeNumber(p.motionZ);
        var mv2 = mx*mx + mz*mz;
        if (mv2 < 0.0003) return;
        p.motionX = mx * 1.4;
        p.motionZ = mz * 1.4;
    }
    function updateWaterJump() {
        if (!cheatState.waterJumpEnabled) return;
        var mc = getMc(); if (mc && mc.currentScreen) return;
        var p = getPlayer(); if (!p) return;
        if (!isInWater(p)) return;
        var my = safeNumber(p.motionY);
        if (my > 0.02 && my < 0.5) {
            var boosted = my * 1.5;
            if (boosted > 0.6) boosted = 0.6;
            p.motionY = boosted;
        }
    }
    function setCheatFly(on) {
        cheatState.flyEnabled = !!on;
        if (!cheatState.flyEnabled) {
            var p = getPlayer();
            if (p && p.capabilities) {
                p.capabilities.allowFlying = false;
                p.capabilities.isFlying = false;
                try { if (p.sendPlayerAbilities) p.sendPlayerAbilities(); } catch(e){}
                cheatState.flyApplied = false;
                cheatState.lastFlySpeedSent = -1;
            }
        }
    }
    function setCheatAntiKB(on) { cheatState.antikbEnabled = !!on; }
    function setCheatSlow(on, factor) {
        cheatState.slowEnabled = !!on;
        if (typeof factor === 'number') cheatState.slowFactor = Math.max(0.3, Math.min(1, factor));
    }
    function setCheatClimb(on) { cheatState.climbEnabled = !!on; }
    function setCheatWaterSpeed(on) { cheatState.waterSpeedEnabled = !!on; }
    function setCheatWaterJump(on) { cheatState.waterJumpEnabled = !!on; }

    var ORIGINS = {
        human:{name:'Human',color:'#88cc88'},
        blazeborn:{name:'Blazeborn',color:'#ff8844'},
        feline:{name:'Feline',color:'#ffcc66'},
        merling:{name:'Merling',color:'#44aaff'},
        arachnid:{name:'Arachnid',color:'#aa5533'},
        shulk:{name:'Shulk',color:'#cc99ff'},
        undead:{name:'Undead',color:'#7a7a5a'},
        golem:{name:'Golem',color:'#999988'},
        turtle:{name:'Turtle',color:'#55bb55'},
        bee:{name:'Bee',color:'#ffcc44'},
        slime:{name:'Slime',color:'#77dd77'}
    };
    var LIST = Object.keys(ORIGINS);

    var EFFECTS = {
        speed:1,slowness:2,haste:3,mining_fatigue:4,strength:5,
        instant_health:6,instant_damage:7,jump_boost:8,nausea:9,
        regeneration:10,resistance:11,fire_resistance:12,
        water_breathing:13,invisibility:14,blindness:15,night_vision:16,
        hunger:17,weakness:18,poison:19,wither:20,
        health_boost:21,absorption:22,saturation:23
    };

    var CMD_PREFIX = 'ogset';
    var CMD_WATER = 'ogwater';
    var CMD_ROTTEN = 'ogrotten';
    var CMD_RE = /ogset\s+([a-z]+)/i;
    var FOREVER_SEC = 60;
    var DEBUG_CMD = false;
    var ANNOUNCE_ENABLED = true;
    var WATER_INTERVAL_MS = 1000;
    var ROTTEN_COOLDOWN_MS = 5000;

    var SUPPRESS_PREFIXES = ['ogset', 'ogwater', 'ogrotten', '#eat', '#steak', '#food', 'og'];
    function isSuppressedMessage(msg) {
        if (!msg || typeof msg !== 'string') return false;
        var lower = msg.toLowerCase();
        for (var i = 0; i < SUPPRESS_PREFIXES.length; i++) {
            if (lower.indexOf(SUPPRESS_PREFIXES[i]) !== -1) return true;
        }
        return false;
    }

    function log() { var a=[].slice.call(arguments); a.unshift('[Origins]'); try{console.log.apply(console,a);}catch(e){} }
    function warn() { }
    function getWorld() { var mc = getMc(); return mc ? (mc.theWorld || null) : null; }

    function javaStr(j) {
        if (j == null) return null;
        if (typeof j === 'string') return j;
        if (typeof j !== 'object') return null;
        try { if (ModAPI.util && ModAPI.util.ustr) { var a = ModAPI.util.ustr(j); if (typeof a === 'string') return a; } } catch(e){}
        try { var s = String(j); if (s !== '[object Object]' && s.indexOf('@') === -1) return s; } catch(e){}
        try { var t = j.toString(); if (t !== '[object Object]' && t.indexOf('@') === -1) return t; } catch(e){}
        try {
            var c = j.Characters;
            if (c) { var d = c.data || c.$array || c;
                if (d && d.length) { var o=''; for (var i=0;i<d.length;i++) if(typeof d[i]==='number') o+=String.fromCharCode(d[i]&0xFFFF); if(o) return o; }
            }
        } catch(e){}
        return null;
    }
    function extractText(o) {
        if (o == null) return null;
        if (typeof o === 'string') return o;
        if (typeof o === 'number' || typeof o === 'boolean') return String(o);
        if (typeof o !== 'object') return null;
        try { if (o.Characters) { var s1 = javaStr(o); if (s1 && s1.length) return s1; } } catch(e){}
        var ms = ['$getUnformattedText','$getFormattedText','$getString','$getUnformattedTextForChat','getUnformattedText','getFormattedText','getString'];
        for (var i = 0; i < ms.length; i++) {
            try { var m = o[ms[i]];
                if (typeof m === 'function') { var v = m.call(o);
                    if (v != null) { var t = extractText(v); if (t && t.length) return t; }
                }
            } catch(e){}
        }
        try {
            var sib = o.$siblings;
            if (sib) { var arr = sib.$array || sib.array1 || sib.data;
                if (arr && arr.length) { var parts=[]; for(var k=0;k<arr.length;k++){var pt=extractText(arr[k]); if(pt)parts.push(pt);} if(parts.length) return parts.join(''); }
            }
        } catch(e){}
        var flds = ['$text','$text$','$field_150267_b'];
        for (var f = 0; f < flds.length; f++) {
            try { var fv = o[flds[f]]; if (fv == null) continue;
                if (typeof fv === 'string') return fv;
                var ft = extractText(fv); if (ft && ft.length) return ft;
            } catch(e){}
        }
        try { var str = String(o);
            if (str && str !== '[object Object]' && str.indexOf('@') === -1 && str.length < 500) return str;
        } catch(e){}
        return null;
    }
    function toJavaString(s) { try { return ModAPI.util.string(s); } catch(e){ return s; } }
    function detectRole() {
        try { if (typeof location !== 'undefined' && /server/i.test(location.pathname || '')) return 'HOST'; } catch(e){}
        return 'CLIENT';
    }
    function sanitizeChat(s) {
        if (s == null) return '';
        s = String(s);
        var out = '';
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            if (c >= 32 && c <= 126) out += s[i];
            else if (c === 10 || c === 13) out += ' ';
        }
        return out;
    }

    var ROLE = 'CLIENT';
    var currentOrigin = null;
    var menuVisible = false;
    var carouselIdx = 0;
    var originsByPlayer = {};
    var lastCmdAt = {};
    var playerState = {};
    var autoMenuShown = false;
    var gamerulesSet = false;
    var hostListenersInstalled = false;
    var clientSuppressInstalled = false;
    var lastCheatKey = null;
    var lastSentOrigin = null;

    var clientWaterLastSent = 0;
    var hostWaterLastHit = {};

    var clientRottenLastSent = 0;
    var hostRottenLastHit = {};

    var lastHungerAmp = -1;

    function getEffId(eff) {
        if (!eff) return -1;
        try { if (typeof eff.getPotionID === 'function') return safeNumber(eff.getPotionID()); } catch(e){}
        try { if (typeof eff.$getPotionID === 'function') return safeNumber(eff.$getPotionID()); } catch(e){}
        try { if (typeof eff.potionID !== 'undefined') return safeNumber(eff.potionID); } catch(e){}
        try { if (typeof eff.$potionID !== 'undefined') return safeNumber(eff.$potionID); } catch(e){}
        try { if (typeof eff.id !== 'undefined') return safeNumber(eff.id); } catch(e){}
        try {
            var potion = eff.potion || eff.$potion;
            if (potion) {
                if (typeof potion.id !== 'undefined') return safeNumber(potion.id);
                if (typeof potion.$id !== 'undefined') return safeNumber(potion.$id);
            }
        } catch(e){}
        return -1;
    }
    function getEffAmp(eff) {
        if (!eff) return 0;
        try { if (typeof eff.getAmplifier === 'function') return safeNumber(eff.getAmplifier()); } catch(e){}
        try { if (typeof eff.amplifier !== 'undefined') return safeNumber(eff.amplifier); } catch(e){}
        try { if (typeof eff.$amplifier !== 'undefined') return safeNumber(eff.$amplifier); } catch(e){}
        return 0;
    }
    function readHungerEffect(p) {
        if (!p) return null;
        try {
            if (typeof p.getActivePotionEffect === 'function') {
                var hg = null;
                try { if (ModAPI.potions) hg = ModAPI.potions.hunger; } catch(e){}
                if (hg) {
                    var eff = p.getActivePotionEffect(hg);
                    if (eff) return eff;
                }
            }
        } catch(e){}
        var maps = [p.activePotionsMap, p.$activePotionsMap, p.potionMap, p.$potionMap, p.potions, p.$potions];
        for (var i = 0; i < maps.length; i++) {
            var m = maps[i];
            if (!m) continue;
            try { if (typeof m.get === 'function') { var e1 = m.get(17); if (e1) return e1; } } catch(e){}
            try { var e3 = m[17]; if (e3) return e3; } catch(e){}
            try {
                if (typeof m.values === 'function') {
                    var vals = m.values();
                    var arr = vals ? (vals.$array || vals.array1 || vals.data || vals) : null;
                    if (arr && arr.length) {
                        for (var k = 0; k < arr.length; k++) if (getEffId(arr[k]) === 17) return arr[k];
                    }
                }
            } catch(e){}
        }
        var lists = [];
        try { if (typeof p.getActivePotionEffects === 'function') lists.push(p.getActivePotionEffects()); } catch(e){}
        try { if (p.activePotionEffects) lists.push(p.activePotionEffects); } catch(e){}
        for (var li = 0; li < lists.length; li++) {
            var lst = lists[li];
            if (!lst) continue;
            var arr2 = lst.$array || lst.array1 || lst.data || lst;
            if (!arr2 || !arr2.length) continue;
            for (var k3 = 0; k3 < arr2.length; k3++) {
                if (getEffId(arr2[k3]) === 17) return arr2[k3];
            }
        }
        return null;
    }
    function clientRottenTick() {
        var p = getPlayer(); if (!p) return;
        var origin = currentOrigin;
        if (ROLE === 'HOST') { var nm = nameOf(p); origin = originsByPlayer[nm] || currentOrigin; }
        if (origin !== 'undead') { lastHungerAmp = -1; return; }
        var eff = readHungerEffect(p);
        var amp = eff ? getEffAmp(eff) : -1;
        if (amp >= 0 && amp !== lastHungerAmp) {
            var now = Date.now();
            if (now - clientRottenLastSent >= ROTTEN_COOLDOWN_MS) {
                clientRottenLastSent = now;
                sendChatAuto(CMD_ROTTEN);
            }
        }
        lastHungerAmp = amp;
    }
    function clientWaterTick() {
        var p = getPlayer(); if (!p) return;
        var origin = currentOrigin;
        if (ROLE === 'HOST') { var nm = nameOf(p); origin = originsByPlayer[nm] || currentOrigin; }
        if (origin !== 'blazeborn') return;
        var water = isInWater(p);
        var now = Date.now();
        if (water && now - clientWaterLastSent >= WATER_INTERVAL_MS) {
            clientWaterLastSent = now;
            sendChatAuto(CMD_WATER);
        }
    }

    var ORIGIN_DESC = {
        human:{pos:['-'],neg:['-']},
        blazeborn:{pos:['Иммунитет огня'],neg:['Вода - урон']},
        feline:{pos:['Ночное зрение всегда'],neg:['В воде: Замедление II']},
        merling:{pos:['Дыхание под водой','Слабость I','В воде: NV, Speed, Jump II'],neg:['На суше: Замедление I']},
        arachnid:{pos:['Лазание по стенам','Прыжок I'],neg:['Слабость I на поверхности']},
        shulk:{pos:['Сопротивление II','Анти-отдача'],neg:['Замедление I']},
        undead:{pos:['Сила I','Гнилая плоть: Реген+Скорость+Сопротивление+Насыщение 20с'],neg:['Замедление III днём на поверхности']},
        golem:{pos:['Сопротивление II','Сила II'],neg:['Замедление I']},
        turtle:{pos:['Сопротивление I','Дыхание под водой','В воде: NV, Speed, Jump II'],neg:['На суше: Замедление II']},
        bee:{pos:['Полёт','Скорость I'],neg:['Слабость III']},
        slime:{pos:['Прыжок II','Скорость I'],neg:['Слабость II']}
    };

    function buildGUI() {
        if (document.getElementById('originsMenu')) return;
        var css = document.createElement('style');
        css.textContent = [
            '#originsMenu{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:520px;max-height:80vh;background:#1a1a22;border:1px solid #555;border-radius:8px;color:#e6e6e6;font-family:Consolas,monospace;z-index:99999;display:none;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.85)}',
            '#originsMenu .head{padding:12px 16px;border-bottom:1px solid #333;font-weight:bold;font-size:14px;text-transform:uppercase}',
            '#originsMenu .row{display:flex;align-items:stretch}',
            '#originsMenu .arr{width:44px;display:flex;align-items:center;justify-content:center;font-size:22px;background:#252530;cursor:pointer;color:#888;user-select:none}',
            '#originsMenu .arr:hover{background:#3a3a4d;color:#fff}',
            '#originsMenu .card{flex:1;padding:14px 18px;min-height:150px;background:#0e0e14}',
            '#originsMenu .ttl{font-size:18px;font-weight:bold;margin-bottom:6px}',
            '#originsMenu h4{margin:10px 0 4px;font-size:12px;color:#888;text-transform:uppercase}',
            '#originsMenu ul{list-style:none;padding:0;margin:0 0 6px 0;font-size:12px;line-height:1.6}',
            '#originsMenu ul.pos li:before{content:"+ ";color:#6d6}',
            '#originsMenu ul.neg li:before{content:"- ";color:#d66}',
            '#originsMenu ul.neg li{color:#e2b8b8}',
            '#originsMenu ul.pos li{color:#b8e2b8}',
            '#originsMenu .foot{padding:10px;text-align:center;border-top:1px solid #333;background:#15151c}',
            '#originsMenu button{padding:8px 32px;background:#2a4a2a;color:#9f9;border:1px solid #4a4a4a;border-radius:4px;cursor:pointer;font-family:inherit}',
            '#originsMenu button:hover{background:#3a6a3a}',
            '#originsMenu button.current{background:#4a4a2a;color:#fd8;cursor:default}',
            '#originsHud{position:fixed;left:10px;top:10px;padding:6px 10px;background:rgba(0,0,0,0.65);border-radius:6px;font-family:Consolas,monospace;font-size:12px;color:#e6e6e6;z-index:9998;pointer-events:none;display:none}'
        ].join('');
        document.head.appendChild(css);
        var menu = document.createElement('div');
        menu.id = 'originsMenu';
        menu.innerHTML = '<div class="head">Choose your Origin</div>' +
            '<div class="row"><div class="arr" id="ogPrev">&lt;</div><div class="card" id="ogCard"></div><div class="arr" id="ogNext">&gt;</div></div>' +
            '<div class="foot"><button id="ogSelect">Select</button></div>';
        document.body.appendChild(menu);
        var hud = document.createElement('div'); hud.id = 'originsHud'; document.body.appendChild(hud);

        function render() {
            var id = LIST[carouselIdx], o = ORIGINS[id], d = ORIGIN_DESC[id] || { pos:[], neg:[] };
            var h = '<div class="ttl" style="color:' + o.color + '">' + o.name + '</div>';
            h += '<h4>Способности</h4><ul class="pos">';
            (d.pos || []).forEach(function(s){ h += '<li>' + s + '</li>'; });
            h += '</ul><h4>Недостатки</h4><ul class="neg">';
            (d.neg || []).forEach(function(s){ h += '<li>' + s + '</li>'; });
            h += '</ul>';
            document.getElementById('ogCard').innerHTML = h;
            var btn = document.getElementById('ogSelect');
            if (id === currentOrigin) { btn.textContent = 'Выбрано'; btn.classList.add('current'); }
            else { btn.textContent = 'Select'; btn.classList.remove('current'); }
        }
        document.getElementById('ogPrev').onclick = function(){ carouselIdx = (carouselIdx - 1 + LIST.length) % LIST.length; render(); };
        document.getElementById('ogNext').onclick = function(){ carouselIdx = (carouselIdx + 1) % LIST.length; render(); };
        document.getElementById('ogSelect').onclick = function(){
            currentOrigin = LIST[carouselIdx];
            toggleMenu(false);
            if (lastSentOrigin !== currentOrigin) {
                if (sendChatAuto(CMD_PREFIX + ' ' + currentOrigin)) {
                    lastSentOrigin = currentOrigin;
                    var o = ORIGINS[currentOrigin];
                    log('Origin selected:', o ? o.name : currentOrigin);
                }
            }
            lastCheatKey = null;
            applyCheats(true);
            updateHud();
            render();
        };
        window.__originsRender = render;
        render();
    }
    function toggleMenu(force) {
        var m = document.getElementById('originsMenu'); if (!m) return;
        menuVisible = (typeof force === 'boolean') ? force : !menuVisible;
        m.style.display = menuVisible ? 'flex' : 'none';
        if (menuVisible && window.__originsRender) window.__originsRender();
    }
    function updateHud() {
        var hud = document.getElementById('originsHud'); if (!hud) return;
        var mc = getMc();
        if (!mc || !mc.theWorld || !mc.thePlayer || !currentOrigin) { hud.style.display='none'; return; }
        hud.style.display='block';
        var o = ORIGINS[currentOrigin];
        hud.textContent = 'Origin: ' + (o ? o.name : currentOrigin);
        hud.style.color = o ? o.color : '#eee';
    }
    function maybeShowMenu() {
        if (ROLE === 'HOST') return;
        if (autoMenuShown) return;
        var mc = getMc();
        if (!mc || !mc.theWorld || !mc.thePlayer) return;
        autoMenuShown = true;
        setTimeout(function(){
            if (!menuVisible) toggleMenu(true);
        }, 1500);
    }

    function sendChatAuto(msg) {
        var p = getPlayer(); if (!p || typeof p.sendChatMessage !== 'function') return false;
        var safe = sanitizeChat(msg); if (!safe) return false;
        try { p.sendChatMessage(toJavaString(safe)); return true; }
        catch(e){ try { p.sendChatMessage(safe); return true; } catch(e2){ return false; } }
    }

    function applyCheats(force) {
        var p = getPlayer();
        var water = p ? isInWater(p) : false;
        var sky = p ? isUnderSky(p) : true;
        var mc = getMc();
        var day = mc ? isDaytime(mc) : true;

        var want = { fly: false, flySpeed: 0.05, antikb: false, slow: false, slowFactor: 0.85, climb: false, waterSpeed: false, waterJump: false };
        switch (currentOrigin) {
            case 'bee': want.fly = true; want.flySpeed = 0.08; break;
            case 'arachnid': want.antikb = true; want.climb = true;
                if (sky) { want.slow = true; want.slowFactor = 0.85; } break;
            case 'shulk': want.antikb = true; break;
            case 'turtle': if (water) { want.waterSpeed = true; want.waterJump = true; }
                else { want.slow = true; want.slowFactor = 0.70; } break;
            case 'merling': if (water) { want.waterSpeed = true; want.waterJump = true; }
                else { want.slow = true; want.slowFactor = 0.85; } break;
            case 'feline': if (water) { want.slow = true; want.slowFactor = 0.70; } break;
            case 'undead':
                if (day && sky && !water) { want.slow = true; want.slowFactor = 0.55; }
                break;
        }
        var key = JSON.stringify(want);
        if (!force && lastCheatKey === key) return;
        lastCheatKey = key;
        setCheatFly(want.fly);
        setCheatAntiKB(want.antikb);
        setCheatSlow(want.slow, want.slowFactor);
        setCheatClimb(want.climb);
        setCheatWaterSpeed(want.waterSpeed);
        setCheatWaterJump(want.waterJump);
        if (want.fly) updateFlySpeed(want.flySpeed);
    }

    function tryParseOrigin(text) {
        if (!text || typeof text !== 'string') return null;
        var m = CMD_RE.exec(text); if (!m) return null;
        var id = m[1].toLowerCase(); if (!ORIGINS[id]) return null;
        var nm = /<\s*([A-Za-z0-9_]+)\s*>/.exec(text);
        return { who: nm ? nm[1] : null, id: id };
    }
    function pickMessage(args) {
        if (!args) return null;
        if (args.length >= 2) { var t = extractText(args[1]); if (t) return t; }
        for (var i = args.length - 1; i >= 0; i--) { var ti = extractText(args[i]); if (ti) return ti; }
        return null;
    }

    function installHostListeners() {
        if (hostListenersInstalled) return;
        hostListenersInstalled = true;
        function hook(name) {
            var fn = ModAPI.hooks.methods[name];
            if (typeof fn !== 'function') return false;
            if (fn.__ogHooked) return true;
            var newFn = function () {
                try {
                    var msg = pickMessage(arguments);
                    if (msg && isSuppressedMessage(msg)) {
                        var lower = msg.toLowerCase();
                        var nm = /<\s*([A-Za-z0-9_]+)\s*>/.exec(msg);
                        var who = nm ? nm[1] : null;
                        var now = Date.now();

                        if (lower.indexOf(CMD_WATER) !== -1) {
                            if (who) {
                                var last = hostWaterLastHit[who] || 0;
                                if (now - last >= WATER_INTERVAL_MS) {
                                    hostWaterLastHit[who] = now;
                                    runCmd('/effect ' + who + ' 7 1 0', 'water:'+who, 0);
                                }
                            }
                            return false;
                        }

                        if (lower.indexOf(CMD_ROTTEN) !== -1) {
                            if (who) {
                                var lastR = hostRottenLastHit[who] || 0;
                                if (now - lastR >= ROTTEN_COOLDOWN_MS) {
                                    hostRottenLastHit[who] = now;
                                    runCmd('/effect ' + who + ' 23 20 0', 'rotten:satur:'+who, 0);
                                    runCmd('/effect ' + who + ' 10 20 0', 'rotten:regen:'+who, 0);
                                    runCmd('/effect ' + who + ' 1 20 0', 'rotten:speed:'+who, 0);
                                    runCmd('/effect ' + who + ' 11 20 0', 'rotten:res:'+who, 0);
                                }
                            }
                            return false;
                        }

                        if (lower.indexOf(CMD_PREFIX) !== -1) {
                            var parsed = tryParseOrigin(msg);
                            if (parsed) {
                                var who2 = parsed.who || nameOf(getPlayer());
                                if (who2) setPlayerOrigin(who2, parsed.id);
                            }
                            return false;
                        }

                        return false;
                    }
                } catch(e){}
                return fn.apply(this, arguments);
            };
            newFn.__ogHooked = true; newFn.__orig = fn;
            ModAPI.hooks.methods[name] = newFn;
            return true;
        }
        hook('nmcg_GuiNewChat_printChatMessage');
        hook('nmcg_GuiNewChat_printChatMessageWithOptionalDeletion');
        hook('nmcg_GuiNewChat_setChatLine');
        hook('nme_Entity_addChatMessage');
        hook('nmce_EntityPlayerSP_addChatMessage');
        hook('nmep_EntityPlayerMP_addChatMessage');
        hook('nms_MinecraftServer_addChatMessage');
    }

    function installClientSuppress() {
        if (clientSuppressInstalled) return;
        clientSuppressInstalled = true;
        function suppressHook(name) {
            var fn = ModAPI.hooks.methods[name];
            if (typeof fn !== 'function') return false;
            if (fn.__ogSuppress) return true;
            var newFn = function () {
                try {
                    var msg = pickMessage(arguments);
                    if (isSuppressedMessage(msg)) return false;
                } catch(e){}
                return fn.apply(this, arguments);
            };
            newFn.__ogSuppress = true; newFn.__orig = fn;
            ModAPI.hooks.methods[name] = newFn;
            return true;
        }
        suppressHook('nmcg_GuiNewChat_printChatMessage');
        suppressHook('nmcg_GuiNewChat_printChatMessageWithOptionalDeletion');
        suppressHook('nmcg_GuiNewChat_setChatLine');
        suppressHook('nme_Entity_addChatMessage');
        suppressHook('nmce_EntityPlayerSP_addChatMessage');
        suppressHook('nmep_EntityPlayerMP_addChatMessage');
        suppressHook('nms_MinecraftServer_addChatMessage');
    }

    function announceOrigin(name, originId) {
        if (!ANNOUNCE_ENABLED) return;
        var o = ORIGINS[originId]; if (!o) return;
        var safeName = sanitizeChat(name); if (!safeName) safeName = 'Player';
        var safeOrigin = sanitizeChat(o.name);
        var msg = '[Origins] Player ' + safeName + ' has chosen ' + safeOrigin;
        try {
            var ok = sendChatAuto(msg);
            if (!ok) throw new Error('sendChatAuto false');
        } catch(e) { ANNOUNCE_ENABLED = false; }
    }

    function setPlayerOrigin(name, originId) {
        var old = originsByPlayer[name];
        var changed = (old !== originId);
        originsByPlayer[name] = originId;
        playerState[name] = { origin: originId, phase: 'clearing', changedAt: Date.now(), lastForeverAt: 0 };
        lastForeverTick[name] = 0;
        if (name === nameOf(getPlayer())) {
            currentOrigin = originId;
            lastCheatKey = null;
            applyCheats(true);
            updateHud();
        }
        if (changed) {
            try { announceOrigin(name, originId); } catch(e){}
        }
    }

    function runCmd(cmd, key, cd) {
        var now = Date.now();
        if (lastCmdAt[key] && safeNumber(now - lastCmdAt[key]) < (cd || 1000)) return false;
        lastCmdAt[key] = now;
        var p = getPlayer(); if (!p) return false;
        var safe = sanitizeChat(cmd); if (!safe) return false;
        try { p.sendChatMessage(toJavaString(safe)); return true; }
        catch(e){ try { p.sendChatMessage(safe); return true; } catch(e2){ return false; } }
    }
    function effById(name, id, dur, amp, cdKey, cdMs) {
        if (!id || id < 1) return;
        if (dur == null) dur = FOREVER_SEC;
        if (amp == null) amp = 0;
        runCmd('/effect ' + name + ' ' + id + ' ' + dur + ' ' + amp, cdKey || ('e:'+name+':'+id), cdMs || 5000);
    }
    function effFor(name, key, dur, amp, cdKey, cdMs) {
        var id = EFFECTS[key]; if (!id) return;
        effById(name, id, dur, amp, cdKey, cdMs);
    }
    function effClear(name) { runCmd('/effect ' + name + ' clear', 'clear:'+name, 500); }
    function giveItem(name, item, count, nbt) {
        var cmd = '/give ' + name + ' ' + item + ' ' + (count||1) + ' 0';
        if (nbt) cmd += ' ' + nbt;
        runCmd(cmd, 'give:'+name+':'+item, 1500);
    }

    function findPlayer(mc, name) {
        try {
            var list = mc.theWorld && mc.theWorld.playerEntities;
            if (list) {
                var arr = list.$array || list.array1 || list.data || list;
                for (var i = 0; i < arr.length; i++) if (nameOf(arr[i]) === name) return arr[i];
            }
        } catch(e){}
        if (nameOf(mc.thePlayer) === name) return mc.thePlayer;
        return null;
    }

    function applyForeverEffects(name, origin) {
        if (lastForeverTick[name] === tickCounter) return;
        lastForeverTick[name] = tickCounter;
        function add(k, amp){ effFor(name, k, FOREVER_SEC, amp||0, 'f:'+name+':'+k, 1500); }
        switch (origin) {
            case 'blazeborn': add('fire_resistance'); break;
            case 'merling': add('water_breathing'); add('weakness'); break;
            case 'shulk': add('resistance', 1); add('slowness'); break;
            case 'undead': add('strength'); break;
            case 'golem': add('resistance',1); add('strength',1); add('slowness',0); break;
            case 'turtle': add('resistance'); add('water_breathing'); break;
            case 'bee': add('speed'); add('weakness', 2); break;
            case 'arachnid': add('speed'); add('jump_boost'); break;
            case 'slime': add('jump_boost', 1); add('speed'); add('weakness', 1); break;
            case 'feline': break;
        }
    }

    function applyConditionalEffects(mc, name, origin, day, rain, p) {
        var water = isInWater(p);
        var sky = isUnderSky(p);
        var inRain = rain && sky;

        switch (origin) {
            case 'blazeborn': break;
            case 'merling':
                if (water) {
                    effFor(name, 'speed', 40, 0, 'c:me:spd', 2500);
                    effFor(name, 'jump_boost', 40, 1, 'c:me:jmp', 2500);
                }
                break;
            case 'arachnid':
                if (sky) effFor(name, 'weakness', 40, 0, 'c:ar:wk', 2500);
                break;
            case 'undead': break;
            case 'turtle':
                if (water) {
                    effFor(name, 'speed', 40, 0, 'c:tu:spd', 2500);
                    effFor(name, 'jump_boost', 40, 1, 'c:tu:jmp', 2500);
                }
                break;
            case 'bee':
                if (inRain) effFor(name, 'weakness', 40, 0, 'c:be:wk', 2500);
                break;
            case 'feline': break;
        }
    }

    function setupGamerules() {
        if (gamerulesSet) return;
        var p = getPlayer(); if (!p) return;
        gamerulesSet = true;
        sendChatAuto('/gamerule sendCommandFeedback false');
        sendChatAuto('/gamerule commandBlockOutput false');
        sendChatAuto('/gamerule logAdminCommands false');
    }

    function hostTick() {
        var mc = getMc(); if (!mc || !mc.theWorld) return;
        var now = Date.now();
        if (!gamerulesSet) setupGamerules();
        var day = isDaytime(mc), rain = isRaining(mc);
        for (var name in originsByPlayer) {
            var origin = originsByPlayer[name];
            if (!origin || origin === 'human') continue;
            var st = playerState[name];
            if (!st || st.origin !== origin) {
                playerState[name] = { origin: origin, phase: 'clearing', changedAt: now, lastForeverAt: 0 };
                effClear(name);
                continue;
            }
            if (st.phase === 'clearing' && safeNumber(now - st.changedAt) > 700) {
                applyForeverEffects(name, origin);
                st.phase = 'active';
                st.lastForeverAt = now;
                continue;
            }
            if (st.phase === 'active') {
                var p = findPlayer(mc, name);
                if (p) {
                    try { applyConditionalEffects(mc, name, origin, day, rain, p); } catch(e){}
                }
                if (safeNumber(now - st.lastForeverAt) > 25000) {
                    applyForeverEffects(name, origin);
                    st.lastForeverAt = now;
                }
            }
        }
    }
    function hostUpdate() {
        try { hostTick(); } catch(e){}
        applyCheats(false);
        updateGamma(computeGammaWant());
        try { clientWaterTick(); } catch(e){}
        try { clientRottenTick(); } catch(e){}
    }

    function clientUpdate() {
        updateHud();
        maybeShowMenu();
        applyCheats(false);
        updateGamma(computeGammaWant());
        try { clientWaterTick(); } catch(e){}
        try { clientRottenTick(); } catch(e){}
    }

    function checkWorldTransition() {
        var mc = getMc();
        if (!mc) return;
        var inWorld = !!(mc.theWorld && mc.thePlayer);

        if (!inWorld && wasInWorld) {
            currentOrigin = null;
            lastSentOrigin = null;
            autoMenuShown = false;
            originsByPlayer = {};
            playerState = {};
            lastCheatKey = null;
            clientWaterLastSent = 0;
            clientRottenLastSent = 0;
            lastHungerAmp = -1;
            lastForeverTick = {};
            setCheatFly(false);
            setCheatAntiKB(false);
            setCheatSlow(false);
            setCheatClimb(false);
            setCheatWaterSpeed(false);
            setCheatWaterJump(false);
            updateGamma(false);
            toggleMenu(false);
            updateHud();
            wasInWorld = false;
        }

        if (inWorld && !wasInWorld) {
            currentOrigin = null;
            lastSentOrigin = null;
            autoMenuShown = false;
            originsByPlayer = {};
            playerState = {};
            lastCheatKey = null;
            clientWaterLastSent = 0;
            clientRottenLastSent = 0;
            lastHungerAmp = -1;
            lastForeverTick = {};
            setCheatFly(false);
            setCheatAntiKB(false);
            setCheatSlow(false);
            setCheatClimb(false);
            setCheatWaterSpeed(false);
            setCheatWaterJump(false);
            updateGamma(false);
            updateHud();
            wasInWorld = true;
        }
    }

    function onFrameTick() {
        updateFly(); updateAntiKB(); updateSlow(); updateClimb();
        updateWaterSpeed(); updateWaterJump();
    }
    function onUpdateTick() {
        tickCounter++;
        try { checkWorldTransition(); } catch(e){}
        if (ROLE === 'HOST') hostUpdate();
        else clientUpdate();
    }
    function installEatCommand() {
        try {
            ModAPI.addEventListener('sendchatmessage', function (e) {
                try {
                    var t = (typeof e === 'string') ? e : extractText(e && (e.message||e.msg||e.text));
                    if (typeof t !== 'string') return true;
                    var cmd = t.trim().toLowerCase();
                    if (cmd === '#eat' || cmd === '#steak' || cmd === '#food') {
                        var who = nameOf(getPlayer());
                        if (who) { giveItem(who, 'minecraft:cooked_beef', 64, null); }
                        return false;
                    }
                } catch(x){}
                return true;
            });
        } catch(e){}
    }

    function boot() {
        ROLE = detectRole();
        log('Origins v0.5 loaded (' + ROLE + ')');
        buildGUI(); updateHud();
        if (ROLE === 'HOST') {
            installHostListeners();
        } else {
            installClientSuppress();
        }
        installEatCommand();
        try { ModAPI.addEventListener('frame', function () { try { onFrameTick(); } catch(e){} }); } catch(e){}
        ModAPI.addEventListener('update', function () { try { onUpdateTick(); } catch(e){} });
    }
    if (typeof ModAPI !== 'undefined' && ModAPI && ModAPI.addEventListener) setTimeout(boot, 700);
    else {
        var t = setInterval(function () {
            if (typeof ModAPI !== 'undefined' && ModAPI && ModAPI.addEventListener) { clearInterval(t); setTimeout(boot, 700); }
        }, 700);
    }
})();
