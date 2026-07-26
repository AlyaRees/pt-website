module.exports = [
"[project]/node_modules/@upstash/core-analytics/dist/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var g = Object.defineProperty;
var k = Object.getOwnPropertyDescriptor;
var _ = Object.getOwnPropertyNames;
var y = Object.prototype.hasOwnProperty;
var w = (l, e)=>{
    for(var t in e)g(l, t, {
        get: e[t],
        enumerable: !0
    });
}, A = (l, e, t, i)=>{
    if (e && typeof e == "object" || typeof e == "function") for (let s of _(e))!y.call(l, s) && s !== t && g(l, s, {
        get: ()=>e[s],
        enumerable: !(i = k(e, s)) || i.enumerable
    });
    return l;
};
var x = (l)=>A(g({}, "__esModule", {
        value: !0
    }), l);
var S = {};
w(S, {
    Analytics: ()=>b
});
module.exports = x(S);
var p = `
local key = KEYS[1]
local field = ARGV[1]

local data = redis.call("ZRANGE", key, 0, -1, "WITHSCORES")
local count = {}

for i = 1, #data, 2 do
  local json_str = data[i]
  local score = tonumber(data[i + 1])
  local obj = cjson.decode(json_str)

  local fieldValue = obj[field]

  if count[fieldValue] == nil then
    count[fieldValue] = score
  else
    count[fieldValue] = count[fieldValue] + score
  end
end

local result = {}
for k, v in pairs(count) do
  table.insert(result, {k, v})
end

return result
`, f = `
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1]) -- First timestamp to check
local increment = tonumber(ARGV[2])       -- Increment between each timestamp
local num_timestamps = tonumber(ARGV[3])  -- Number of timestampts to check (24 for a day and 24 * 7 for a week)
local num_elements = tonumber(ARGV[4])    -- Number of elements to fetch in each category
local check_at_most = tonumber(ARGV[5])   -- Number of elements to check at most.

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

-- select num_elements many items
local true_group = {}
local false_group = {}
local denied_group = {}
local true_count = 0
local false_count = 0
local denied_count = 0
local i = #result - 1

-- index to stop at after going through "checkAtMost" many items:
local cutoff_index = #result - 2 * check_at_most

-- iterate over the results
while (true_count + false_count + denied_count) < (num_elements * 3) and 1 <= i and i >= cutoff_index do
  local score = tonumber(result[i + 1])
  if score > 0 then
    local element = result[i]
    if string.find(element, "success\\":true") and true_count < num_elements then
      table.insert(true_group, {score, element})
      true_count = true_count + 1
    elseif string.find(element, "success\\":false") and false_count < num_elements then
      table.insert(false_group, {score, element})
      false_count = false_count + 1
    elseif string.find(element, "success\\":\\"denied") and denied_count < num_elements then
      table.insert(denied_group, {score, element})
      denied_count = denied_count + 1
    end
  end
  i = i - 2
end

return {true_group, false_group, denied_group}
`, h = `
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])
local num_timestamps = tonumber(ARGV[3])

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

return result
`;
var b = class {
    redis;
    prefix;
    bucketSize;
    constructor(e){
        this.redis = e.redis, this.prefix = e.prefix ?? "@upstash/analytics", this.bucketSize = this.parseWindow(e.window);
    }
    validateTableName(e) {
        if (!/^[a-zA-Z0-9_-]+$/.test(e)) throw new Error(`Invalid table name: ${e}. Table names can only contain letters, numbers, dashes and underscores.`);
    }
    parseWindow(e) {
        if (typeof e == "number") {
            if (e <= 0) throw new Error(`Invalid window: ${e}`);
            return e;
        }
        let t = /^(\d+)([smhd])$/;
        if (!t.test(e)) throw new Error(`Invalid window: ${e}`);
        let [, i, s] = e.match(t), n = parseInt(i);
        switch(s){
            case "s":
                return n * 1e3;
            case "m":
                return n * 1e3 * 60;
            case "h":
                return n * 1e3 * 60 * 60;
            case "d":
                return n * 1e3 * 60 * 60 * 24;
            default:
                throw new Error(`Invalid window unit: ${s}`);
        }
    }
    getBucket(e) {
        let t = e ?? Date.now();
        return Math.floor(t / this.bucketSize) * this.bucketSize;
    }
    async ingest(e, ...t) {
        this.validateTableName(e), await Promise.all(t.map(async (i)=>{
            let s = this.getBucket(i.time), n = [
                this.prefix,
                e,
                s
            ].join(":");
            await this.redis.zincrby(n, 1, JSON.stringify({
                ...i,
                time: void 0
            }));
        }));
    }
    formatBucketAggregate(e, t, i) {
        let s = {};
        return e.forEach(([n, r])=>{
            t == "success" && (n = n === 1 ? "true" : n === null ? "false" : n), s[t] = s[t] || {}, s[t][(n ?? "null").toString()] = r;
        }), {
            time: i,
            ...s
        };
    }
    async aggregateBucket(e, t, i) {
        this.validateTableName(e);
        let s = this.getBucket(i), n = [
            this.prefix,
            e,
            s
        ].join(":"), r = await this.redis.eval(p, [
            n
        ], [
            t
        ]);
        return this.formatBucketAggregate(r, t, s);
    }
    async aggregateBuckets(e, t, i, s) {
        this.validateTableName(e);
        let n = this.getBucket(s), r = [];
        for(let o = 0; o < i; o += 1)r.push(this.aggregateBucket(e, t, n)), n = n - this.bucketSize;
        return Promise.all(r);
    }
    async aggregateBucketsWithPipeline(e, t, i, s, n) {
        this.validateTableName(e), n = n ?? 48;
        let r = this.getBucket(s), o = [], c = this.redis.pipeline(), u = [];
        for(let a = 1; a <= i; a += 1){
            let d = [
                this.prefix,
                e,
                r
            ].join(":");
            c.eval(p, [
                d
            ], [
                t
            ]), o.push(r), r = r - this.bucketSize, (a % n == 0 || a == i) && (u.push(c.exec()), c = this.redis.pipeline());
        }
        return (await Promise.all(u)).flat().map((a, d)=>this.formatBucketAggregate(a, t, o[d]));
    }
    async getAllowedBlocked(e, t, i) {
        this.validateTableName(e);
        let s = [
            this.prefix,
            e
        ].join(":"), n = this.getBucket(i), r = await this.redis.eval(h, [
            s
        ], [
            n,
            this.bucketSize,
            t
        ]), o = {};
        for(let c = 0; c < r.length; c += 2){
            let u = r[c], m = u.identifier, a = +r[c + 1];
            o[m] || (o[m] = {
                success: 0,
                blocked: 0
            }), o[m][u.success ? "success" : "blocked"] = a;
        }
        return o;
    }
    async getMostAllowedBlocked(e, t, i, s, n) {
        this.validateTableName(e);
        let r = [
            this.prefix,
            e
        ].join(":"), o = this.getBucket(s), c = n ?? i * 5, [u, m, a] = await this.redis.eval(f, [
            r
        ], [
            o,
            this.bucketSize,
            t,
            i,
            c
        ]);
        return {
            allowed: this.toDicts(u),
            ratelimited: this.toDicts(m),
            denied: this.toDicts(a)
        };
    }
    toDicts(e) {
        let t = [];
        for(let i = 0; i < e.length; i += 1){
            let s = +e[i][0], n = e[i][1];
            t.push({
                identifier: n.identifier,
                count: s
            });
        }
        return t;
    }
};
0 && (module.exports = {
    Analytics
});
}),
"[project]/node_modules/@upstash/ratelimit/dist/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all)=>{
    for(var name in all)__defProp(target, name, {
        get: all[name],
        enumerable: true
    });
};
var __copyProps = (to, from, except, desc)=>{
    if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
            get: ()=>from[key],
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
    }
    return to;
};
var __toCommonJS = (mod)=>__copyProps(__defProp({}, "__esModule", {
        value: true
    }), mod);
// src/index.ts
var src_exports = {};
__export(src_exports, {
    Analytics: ()=>Analytics,
    IpDenyList: ()=>ip_deny_list_exports,
    MultiRegionRatelimit: ()=>MultiRegionRatelimit,
    Ratelimit: ()=>RegionRatelimit
});
module.exports = __toCommonJS(src_exports);
// src/analytics.ts
var import_core_analytics = __turbopack_context__.r("[project]/node_modules/@upstash/core-analytics/dist/index.js [app-route] (ecmascript)");
var Analytics = class {
    analytics;
    table = "events";
    constructor(config){
        this.analytics = new import_core_analytics.Analytics({
            // @ts-expect-error we need to fix the types in core-analytics, it should only require the methods it needs, not the whole sdk
            redis: config.redis,
            window: "1h",
            prefix: config.prefix ?? "@upstash/ratelimit",
            retention: "90d"
        });
    }
    /**
   * Try to extract the geo information from the request
   *
   * This handles Vercel's `req.geo` and  and Cloudflare's `request.cf` properties
   * @param req
   * @returns
   */ extractGeo(req) {
        if (req.geo !== void 0) {
            return req.geo;
        }
        if (req.cf !== void 0) {
            return req.cf;
        }
        return {};
    }
    async record(event) {
        await this.analytics.ingest(this.table, event);
    }
    async series(filter, cutoff) {
        const timestampCount = Math.min((this.analytics.getBucket(Date.now()) - this.analytics.getBucket(cutoff)) / (60 * 60 * 1e3), 256);
        return this.analytics.aggregateBucketsWithPipeline(this.table, filter, timestampCount);
    }
    async getUsage(cutoff = 0) {
        const timestampCount = Math.min((this.analytics.getBucket(Date.now()) - this.analytics.getBucket(cutoff)) / (60 * 60 * 1e3), 256);
        const records = await this.analytics.getAllowedBlocked(this.table, timestampCount);
        return records;
    }
    async getUsageOverTime(timestampCount, groupby) {
        const result = await this.analytics.aggregateBucketsWithPipeline(this.table, groupby, timestampCount);
        return result;
    }
    async getMostAllowedBlocked(timestampCount, getTop, checkAtMost) {
        getTop = getTop ?? 5;
        const timestamp = void 0;
        return this.analytics.getMostAllowedBlocked(this.table, timestampCount, getTop, timestamp, checkAtMost);
    }
};
// src/cache.ts
var Cache = class {
    /**
   * Stores identifier -> reset (in milliseconds)
   */ cache;
    constructor(cache){
        this.cache = cache;
    }
    isBlocked(identifier) {
        if (!this.cache.has(identifier)) {
            return {
                blocked: false,
                reset: 0
            };
        }
        const reset = this.cache.get(identifier);
        if (reset < Date.now()) {
            this.cache.delete(identifier);
            return {
                blocked: false,
                reset: 0
            };
        }
        return {
            blocked: true,
            reset
        };
    }
    blockUntil(identifier, reset) {
        this.cache.set(identifier, reset);
    }
    set(key, value) {
        this.cache.set(key, value);
    }
    get(key) {
        return this.cache.get(key) || null;
    }
    incr(key, incrementAmount = 1) {
        let value = this.cache.get(key) ?? 0;
        value += incrementAmount;
        this.cache.set(key, value);
        return value;
    }
    pop(key) {
        this.cache.delete(key);
    }
    empty() {
        this.cache.clear();
    }
    size() {
        return this.cache.size;
    }
};
// src/constants.ts
var DYNAMIC_LIMIT_KEY_SUFFIX = ":dynamic:global";
var DEFAULT_PREFIX = "@upstash/ratelimit";
// src/duration.ts
function ms(d) {
    const match = d.match(/^(\d+)\s?(ms|s|m|h|d)$/);
    if (!match) {
        throw new Error(`Unable to parse window size: ${d}`);
    }
    const time = Number.parseInt(match[1]);
    const unit = match[2];
    switch(unit){
        case "ms":
            {
                return time;
            }
        case "s":
            {
                return time * 1e3;
            }
        case "m":
            {
                return time * 1e3 * 60;
            }
        case "h":
            {
                return time * 1e3 * 60 * 60;
            }
        case "d":
            {
                return time * 1e3 * 60 * 60 * 24;
            }
        default:
            {
                throw new Error(`Unable to parse window size: ${d}`);
            }
    }
}
// src/hash.ts
var safeEval = async (ctx, script, keys, args)=>{
    try {
        return await ctx.redis.evalsha(script.hash, keys, args);
    } catch (error) {
        if (`${error}`.includes("NOSCRIPT")) {
            return await ctx.redis.eval(script.script, keys, args);
        }
        throw error;
    }
};
// src/lua-scripts/single.ts
var fixedWindowLimitScript = `
  local key           = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens        = tonumber(ARGV[1])  -- default limit
  local window        = ARGV[2]
  local incrementBy   = ARGV[3] -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local r = redis.call("INCRBY", key, incrementBy)
  if r == tonumber(incrementBy) then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end

  return {r, effectiveLimit}
`;
var fixedWindowRemainingTokensScript = `
  local key = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens = tonumber(ARGV[1])  -- default limit

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local value = redis.call('GET', key)
  local usedTokens = 0
  if value then
    usedTokens = tonumber(value)
  end
  
  return {effectiveLimit - usedTokens, effectiveLimit}
`;
var slidingWindowLimitScript = `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  local incrementBy = tonumber(ARGV[4]) -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  -- Only check limit if not refunding (negative rate)
  if incrementBy > 0 and requestsInPreviousWindow + requestsInCurrentWindow >= effectiveLimit then
    return {-1, effectiveLimit}
  end

  local newValue = redis.call("INCRBY", currentKey, incrementBy)
  if newValue == incrementBy then
    -- The first time this key is set, the value will be equal to incrementBy.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return {effectiveLimit - ( newValue + requestsInPreviousWindow ), effectiveLimit}
`;
var slidingWindowRemainingTokensScript = `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end

  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  local usedTokens = requestsInPreviousWindow + requestsInCurrentWindow
  return {effectiveLimit - usedTokens, effectiveLimit}
`;
var tokenBucketLimitScript = `
  local key         = KEYS[1]           -- identifier including prefixes
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens
  local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
  local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
  local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
  local incrementBy = tonumber(ARGV[5]) -- how many tokens to consume, default is 1

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
  local refilledAt
  local tokens

  if bucket[1] == false then
    refilledAt = now
    tokens = effectiveLimit
  else
    refilledAt = tonumber(bucket[1])
    tokens = tonumber(bucket[2])
  end
        
  if now >= refilledAt + interval then
    local numRefills = math.floor((now - refilledAt) / interval)
    tokens = math.min(effectiveLimit, tokens + numRefills * refillRate)

    refilledAt = refilledAt + numRefills * interval
  end

  -- Only reject if tokens are 0 and we're consuming (not refunding)
  if tokens == 0 and incrementBy > 0 then
    return {-1, refilledAt + interval, effectiveLimit}
  end

  local remaining = tokens - incrementBy
  local expireAt = math.ceil(((effectiveLimit - remaining) / refillRate)) * interval
        
  redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)

  if (expireAt > 0) then
    redis.call("PEXPIRE", key, expireAt)
  end
  return {remaining, refilledAt + interval, effectiveLimit}
`;
var tokenBucketIdentifierNotFound = -1;
var tokenBucketRemainingTokensScript = `
  local key         = KEYS[1]
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")

  if bucket[1] == false then
    return {effectiveLimit, ${tokenBucketIdentifierNotFound}, effectiveLimit}
  end
        
  return {tonumber(bucket[2]), tonumber(bucket[1]), effectiveLimit}
`;
var cachedFixedWindowLimitScript = `
  local key     = KEYS[1]
  local window  = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == incrementBy then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end
      
  return r
`;
var cachedFixedWindowRemainingTokenScript = `
  local key = KEYS[1]
  local tokens = 0

  local value = redis.call('GET', key)
  if value then
      tokens = value
  end
  return tokens
`;
// src/lua-scripts/multi.ts
var fixedWindowLimitScript2 = `
	local key           = KEYS[1]
	local id            = ARGV[1]
	local window        = ARGV[2]
	local incrementBy   = tonumber(ARGV[3])

	redis.call("HSET", key, id, incrementBy)
	local fields = redis.call("HGETALL", key)
	if #fields == 2 and tonumber(fields[2])==incrementBy then
	-- The first time this key is set, and the value will be equal to incrementBy.
	-- So we only need the expire command once
	  redis.call("PEXPIRE", key, window)
	end

	return fields
`;
var fixedWindowRemainingTokensScript2 = `
      local key = KEYS[1]
      local tokens = 0

      local fields = redis.call("HGETALL", key)

      return fields
    `;
var slidingWindowLimitScript2 = `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local tokens        = tonumber(ARGV[1]) -- tokens per window
	local now           = ARGV[2]           -- current timestamp in milliseconds
	local window        = ARGV[3]           -- interval in milliseconds
	local requestId     = ARGV[4]           -- uuid for this request
	local incrementBy   = tonumber(ARGV[5]) -- custom rate, default is  1

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window

	-- Only check limit if not refunding (negative rate)
	if incrementBy > 0 and requestsInPreviousWindow * (1 - percentageInCurrent ) + requestsInCurrentWindow + incrementBy > tokens then
	  return {currentFields, previousFields, false}
	end

	redis.call("HSET", currentKey, requestId, incrementBy)

	if requestsInCurrentWindow == 0 then 
	  -- The first time this key is set, the value will be equal to incrementBy.
	  -- So we only need the expire command once
	  redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
	end
	return {currentFields, previousFields, true}
`;
var slidingWindowRemainingTokensScript2 = `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local now         	= ARGV[1]           -- current timestamp in milliseconds
  	local window      	= ARGV[2]           -- interval in milliseconds

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window
  	requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
	
	return requestsInCurrentWindow + requestsInPreviousWindow
`;
// src/lua-scripts/reset.ts
var resetScript = `
      local pattern = KEYS[1]

      -- Initialize cursor to start from 0
      local cursor = "0"

      repeat
          -- Scan for keys matching the pattern
          local scan_result = redis.call('SCAN', cursor, 'MATCH', pattern)

          -- Extract cursor for the next iteration
          cursor = scan_result[1]

          -- Extract keys from the scan result
          local keys = scan_result[2]

          for i=1, #keys do
          redis.call('DEL', keys[i])
          end

      -- Continue scanning until cursor is 0 (end of keyspace)
      until cursor == "0"
    `;
// src/lua-scripts/hash.ts
var SCRIPTS = {
    singleRegion: {
        fixedWindow: {
            limit: {
                script: fixedWindowLimitScript,
                hash: "472e55443b62f60d0991028456c57815a387066d"
            },
            getRemaining: {
                script: fixedWindowRemainingTokensScript,
                hash: "40515c9dd0a08f8584f5f9b593935f6a87c1c1c3"
            }
        },
        slidingWindow: {
            limit: {
                script: slidingWindowLimitScript,
                hash: "977fb636fb5ceb7e98a96d1b3a1272ba018efdae"
            },
            getRemaining: {
                script: slidingWindowRemainingTokensScript,
                hash: "ee3a3265fad822f83acad23f8a1e2f5c0b156b03"
            }
        },
        tokenBucket: {
            limit: {
                script: tokenBucketLimitScript,
                hash: "b35c5bc0b7fdae7dd0573d4529911cabaf9d1d89"
            },
            getRemaining: {
                script: tokenBucketRemainingTokensScript,
                hash: "deb03663e8af5a968deee895dd081be553d2611b"
            }
        },
        cachedFixedWindow: {
            limit: {
                script: cachedFixedWindowLimitScript,
                hash: "c26b12703dd137939b9a69a3a9b18e906a2d940f"
            },
            getRemaining: {
                script: cachedFixedWindowRemainingTokenScript,
                hash: "8e8f222ccae68b595ee6e3f3bf2199629a62b91a"
            }
        }
    },
    multiRegion: {
        fixedWindow: {
            limit: {
                script: fixedWindowLimitScript2,
                hash: "a8c14f3835aa87bd70e5e2116081b81664abcf5c"
            },
            getRemaining: {
                script: fixedWindowRemainingTokensScript2,
                hash: "8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd"
            }
        },
        slidingWindow: {
            limit: {
                script: slidingWindowLimitScript2,
                hash: "1e7ca8dcd2d600a6d0124a67a57ea225ed62921b"
            },
            getRemaining: {
                script: slidingWindowRemainingTokensScript2,
                hash: "558c9306b7ec54abb50747fe0b17e5d44bd24868"
            }
        }
    }
};
var RESET_SCRIPT = {
    script: resetScript,
    hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50"
};
// src/types.ts
var DenyListExtension = "denyList";
var IpDenyListKey = "ipDenyList";
var IpDenyListStatusKey = "ipDenyListStatus";
// src/deny-list/scripts.ts
var checkDenyListScript = `
  -- Checks if values provideed in ARGV are present in the deny lists.
  -- This is done using the allDenyListsKey below.

  -- Additionally, checks the status of the ip deny list using the
  -- ipDenyListStatusKey below. Here are the possible states of the
  -- ipDenyListStatusKey key:
  -- * status == -1: set to "disabled" with no TTL
  -- * status == -2: not set, meaning that is was set before but expired
  -- * status  >  0: set to "valid", with a TTL
  --
  -- In the case of status == -2, we set the status to "pending" with
  -- 30 second ttl. During this time, the process which got status == -2
  -- will update the ip deny list.

  local allDenyListsKey     = KEYS[1]
  local ipDenyListStatusKey = KEYS[2]

  local results = redis.call('SMISMEMBER', allDenyListsKey, unpack(ARGV))
  local status  = redis.call('TTL', ipDenyListStatusKey)
  if status == -2 then
    redis.call('SETEX', ipDenyListStatusKey, 30, "pending")
  end

  return { results, status }
`;
// src/deny-list/ip-deny-list.ts
var ip_deny_list_exports = {};
__export(ip_deny_list_exports, {
    ThresholdError: ()=>ThresholdError,
    disableIpDenyList: ()=>disableIpDenyList,
    updateIpDenyList: ()=>updateIpDenyList
});
// src/deny-list/time.ts
var MILLISECONDS_IN_HOUR = 60 * 60 * 1e3;
var MILLISECONDS_IN_DAY = 24 * MILLISECONDS_IN_HOUR;
var MILLISECONDS_TO_2AM = 2 * MILLISECONDS_IN_HOUR;
var getIpListTTL = (time)=>{
    const now = time || Date.now();
    const timeSinceLast2AM = (now - MILLISECONDS_TO_2AM) % MILLISECONDS_IN_DAY;
    return MILLISECONDS_IN_DAY - timeSinceLast2AM;
};
// src/deny-list/ip-deny-list.ts
var baseUrl = "https://raw.githubusercontent.com/stamparm/ipsum/master/levels";
var ThresholdError = class extends Error {
    constructor(threshold){
        super(`Allowed threshold values are from 1 to 8, 1 and 8 included. Received: ${threshold}`);
        this.name = "ThresholdError";
    }
};
var getIpDenyList = async (threshold)=>{
    if (typeof threshold !== "number" || threshold < 1 || threshold > 8) {
        throw new ThresholdError(threshold);
    }
    try {
        const response = await fetch(`${baseUrl}/${threshold}.txt`);
        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.statusText}`);
        }
        const data = await response.text();
        const lines = data.split("\n");
        return lines.filter((value)=>value.length > 0);
    } catch (error) {
        throw new Error(`Failed to fetch ip deny list: ${error}`);
    }
};
var updateIpDenyList = async (redis, prefix, threshold, ttl)=>{
    const allIps = await getIpDenyList(threshold);
    const allDenyLists = [
        prefix,
        DenyListExtension,
        "all"
    ].join(":");
    const ipDenyList = [
        prefix,
        DenyListExtension,
        IpDenyListKey
    ].join(":");
    const statusKey = [
        prefix,
        IpDenyListStatusKey
    ].join(":");
    const transaction = redis.multi();
    transaction.sdiffstore(allDenyLists, allDenyLists, ipDenyList);
    transaction.del(ipDenyList);
    transaction.sadd(ipDenyList, allIps.at(0), ...allIps.slice(1));
    transaction.sdiffstore(ipDenyList, ipDenyList, allDenyLists);
    transaction.sunionstore(allDenyLists, allDenyLists, ipDenyList);
    transaction.set(statusKey, "valid", {
        px: ttl ?? getIpListTTL()
    });
    return await transaction.exec();
};
var disableIpDenyList = async (redis, prefix)=>{
    const allDenyListsKey = [
        prefix,
        DenyListExtension,
        "all"
    ].join(":");
    const ipDenyListKey = [
        prefix,
        DenyListExtension,
        IpDenyListKey
    ].join(":");
    const statusKey = [
        prefix,
        IpDenyListStatusKey
    ].join(":");
    const transaction = redis.multi();
    transaction.sdiffstore(allDenyListsKey, allDenyListsKey, ipDenyListKey);
    transaction.del(ipDenyListKey);
    transaction.set(statusKey, "disabled");
    return await transaction.exec();
};
// src/deny-list/deny-list.ts
var denyListCache = new Cache(/* @__PURE__ */ new Map());
var checkDenyListCache = (members)=>{
    return members.find((member)=>denyListCache.isBlocked(member).blocked);
};
var blockMember = (member)=>{
    if (denyListCache.size() > 1e3) denyListCache.empty();
    denyListCache.blockUntil(member, Date.now() + 6e4);
};
var checkDenyList = async (redis, prefix, members)=>{
    const [deniedValues, ipDenyListStatus] = await redis.eval(checkDenyListScript, [
        [
            prefix,
            DenyListExtension,
            "all"
        ].join(":"),
        [
            prefix,
            IpDenyListStatusKey
        ].join(":")
    ], members);
    let deniedValue = void 0;
    deniedValues.map((memberDenied, index)=>{
        if (memberDenied) {
            blockMember(members[index]);
            deniedValue = members[index];
        }
    });
    return {
        deniedValue,
        invalidIpDenyList: ipDenyListStatus === -2
    };
};
var resolveLimitPayload = (redis, prefix, [ratelimitResponse, denyListResponse], threshold)=>{
    if (denyListResponse.deniedValue) {
        ratelimitResponse.success = false;
        ratelimitResponse.remaining = 0;
        ratelimitResponse.reason = "denyList";
        ratelimitResponse.deniedValue = denyListResponse.deniedValue;
    }
    if (denyListResponse.invalidIpDenyList) {
        const updatePromise = updateIpDenyList(redis, prefix, threshold);
        ratelimitResponse.pending = Promise.all([
            ratelimitResponse.pending,
            updatePromise
        ]);
    }
    return ratelimitResponse;
};
var defaultDeniedResponse = (deniedValue)=>{
    return {
        success: false,
        limit: 0,
        remaining: 0,
        reset: 0,
        pending: Promise.resolve(),
        reason: "denyList",
        deniedValue
    };
};
// src/ratelimit.ts
var Ratelimit = class {
    limiter;
    ctx;
    prefix;
    timeout;
    primaryRedis;
    analytics;
    enableProtection;
    denyListThreshold;
    dynamicLimits;
    constructor(config){
        this.ctx = config.ctx;
        this.limiter = config.limiter;
        this.timeout = config.timeout ?? 5e3;
        this.prefix = config.prefix ?? DEFAULT_PREFIX;
        this.dynamicLimits = config.dynamicLimits ?? false;
        this.enableProtection = config.enableProtection ?? false;
        this.denyListThreshold = config.denyListThreshold ?? 6;
        this.primaryRedis = "redis" in this.ctx ? this.ctx.redis : this.ctx.regionContexts[0].redis;
        if ("redis" in this.ctx) {
            this.ctx.dynamicLimits = this.dynamicLimits;
            this.ctx.prefix = this.prefix;
        }
        this.analytics = config.analytics ? new Analytics({
            redis: this.primaryRedis,
            prefix: this.prefix
        }) : void 0;
        if (config.ephemeralCache instanceof Map) {
            this.ctx.cache = new Cache(config.ephemeralCache);
        } else if (config.ephemeralCache === void 0) {
            this.ctx.cache = new Cache(/* @__PURE__ */ new Map());
        }
    }
    /**
   * Determine if a request should pass or be rejected based on the identifier and previously chosen ratelimit.
   *
   * Use this if you want to reject all requests that you can not handle right now.
   *
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: Redis.fromEnv(),
   *    limiter: Ratelimit.slidingWindow(10, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.limit(id)
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   *
   * @param req.rate - The rate at which tokens will be added or consumed from the token bucket. A higher rate allows for more requests to be processed. Defaults to 1 token per interval if not specified.
   *
   * Usage with `req.rate`
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: Redis.fromEnv(),
   *    limiter: Ratelimit.slidingWindow(100, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.limit(id, {rate: 10})
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   */ limit = async (identifier, req)=>{
        let timeoutId = null;
        try {
            const response = this.getRatelimitResponse(identifier, req);
            const { responseArray, newTimeoutId } = this.applyTimeout(response);
            timeoutId = newTimeoutId;
            const timedResponse = await Promise.race(responseArray);
            const finalResponse = this.submitAnalytics(timedResponse, identifier, req);
            return finalResponse;
        } finally{
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    };
    /**
   * Block until the request may pass or timeout is reached.
   *
   * This method returns a promise that resolves as soon as the request may be processed
   * or after the timeout has been reached.
   *
   * Use this if you want to delay the request until it is ready to get processed.
   *
   * @example
   * ```ts
   *  const ratelimit = new Ratelimit({
   *    redis: Redis.fromEnv(),
   *    limiter: Ratelimit.slidingWindow(10, "10 s")
   *  })
   *
   *  const { success } = await ratelimit.blockUntilReady(id, 60_000)
   *  if (!success){
   *    return "Nope"
   *  }
   *  return "Yes"
   * ```
   */ blockUntilReady = async (identifier, timeout)=>{
        if (timeout <= 0) {
            throw new Error("timeout must be positive");
        }
        let res;
        const deadline = Date.now() + timeout;
        while(true){
            res = await this.limit(identifier);
            if (res.success) {
                break;
            }
            if (res.reset === 0) {
                throw new Error("This should not happen");
            }
            const wait = Math.min(res.reset, deadline) - Date.now();
            await new Promise((r)=>setTimeout(r, wait));
            if (Date.now() > deadline) {
                break;
            }
        }
        return res;
    };
    resetUsedTokens = async (identifier)=>{
        const pattern = [
            this.prefix,
            identifier
        ].join(":");
        await this.limiter().resetTokens(this.ctx, pattern);
    };
    /**
   * Returns the remaining token count together with a reset timestamps
   * 
   * @param identifier identifir to check
   * @returns object with `remaining`, `reset`, and `limit` fields. `remaining` denotes
   *          the remaining tokens, `limit` is the effective limit (considering dynamic
   *          limits if enabled), and `reset` denotes the timestamp when the tokens reset.
   */ getRemaining = async (identifier)=>{
        const pattern = [
            this.prefix,
            identifier
        ].join(":");
        return await this.limiter().getRemaining(this.ctx, pattern);
    };
    /**
   * Checks if the identifier or the values in req are in the deny list cache.
   * If so, returns the default denied response.
   * 
   * Otherwise, calls redis to check the rate limit and deny list. Returns after
   * resolving the result. Resolving is overriding the rate limit result if
   * the some value is in deny list.
   * 
   * @param identifier identifier to block
   * @param req options with ip, user agent, country, rate and geo info
   * @returns rate limit response
   */ getRatelimitResponse = async (identifier, req)=>{
        const key = this.getKey(identifier);
        const definedMembers = this.getDefinedMembers(identifier, req);
        const deniedValue = checkDenyListCache(definedMembers);
        const result = deniedValue ? [
            defaultDeniedResponse(deniedValue),
            {
                deniedValue,
                invalidIpDenyList: false
            }
        ] : await Promise.all([
            this.limiter().limit(this.ctx, key, req?.rate),
            this.enableProtection ? checkDenyList(this.primaryRedis, this.prefix, definedMembers) : {
                deniedValue: void 0,
                invalidIpDenyList: false
            }
        ]);
        return resolveLimitPayload(this.primaryRedis, this.prefix, result, this.denyListThreshold);
    };
    /**
   * Creates an array with the original response promise and a timeout promise
   * if this.timeout > 0.
   * 
   * @param response Ratelimit response promise
   * @returns array with the response and timeout promise. also includes the timeout id
   */ applyTimeout = (response)=>{
        let newTimeoutId = null;
        const responseArray = [
            response
        ];
        if (this.timeout > 0) {
            const timeoutResponse = new Promise((resolve)=>{
                newTimeoutId = setTimeout(()=>{
                    resolve({
                        success: true,
                        limit: 0,
                        remaining: 0,
                        reset: 0,
                        pending: Promise.resolve(),
                        reason: "timeout"
                    });
                }, this.timeout);
            });
            responseArray.push(timeoutResponse);
        }
        return {
            responseArray,
            newTimeoutId
        };
    };
    /**
   * submits analytics if this.analytics is set
   * 
   * @param ratelimitResponse final rate limit response
   * @param identifier identifier to submit
   * @param req limit options
   * @returns rate limit response after updating the .pending field
   */ submitAnalytics = (ratelimitResponse, identifier, req)=>{
        if (this.analytics) {
            try {
                const geo = req ? this.analytics.extractGeo(req) : void 0;
                const analyticsP = this.analytics.record({
                    identifier: ratelimitResponse.reason === "denyList" ? ratelimitResponse.deniedValue : identifier,
                    time: Date.now(),
                    success: ratelimitResponse.reason === "denyList" ? "denied" : ratelimitResponse.success,
                    ...geo
                }).catch((error)=>{
                    let errorMessage = "Failed to record analytics";
                    if (`${error}`.includes("WRONGTYPE")) {
                        errorMessage = `
    Failed to record analytics. See the information below:

    This can occur when you uprade to Ratelimit version 1.1.2
    or later from an earlier version.

    This occurs simply because the way we store analytics data
    has changed. To avoid getting this error, disable analytics
    for *an hour*, then simply enable it back.

    `;
                    }
                    console.warn(errorMessage, error);
                });
                ratelimitResponse.pending = Promise.all([
                    ratelimitResponse.pending,
                    analyticsP
                ]);
            } catch (error) {
                console.warn("Failed to record analytics", error);
            }
            ;
        }
        ;
        return ratelimitResponse;
    };
    getKey = (identifier)=>{
        return [
            this.prefix,
            identifier
        ].join(":");
    };
    /**
   * returns a list of defined values from
   * [identifier, req.ip, req.userAgent, req.country]
   * 
   * @param identifier identifier
   * @param req limit options
   * @returns list of defined values
   */ getDefinedMembers = (identifier, req)=>{
        const members = [
            identifier,
            req?.ip,
            req?.userAgent,
            req?.country
        ];
        return members.filter(Boolean);
    };
    /**
   * Set a dynamic rate limit globally.
   * 
   * When dynamicLimits is enabled, this limit will override the default limit
   * set in the constructor for all requests.
   * 
   * @example
   * ```ts
   * const ratelimit = new Ratelimit({
   *   redis: Redis.fromEnv(),
   *   limiter: Ratelimit.slidingWindow(10, "10 s"),
   *   dynamicLimits: true
   * });
   * 
   * // Set global dynamic limit to 120 requests
   * await ratelimit.setDynamicLimit({ limit: 120 });
   * 
   * // Disable dynamic limit (falls back to default)
   * await ratelimit.setDynamicLimit({ limit: false });
   * ```
   * 
   * @param options.limit - The new rate limit to apply globally, or false to disable
   */ setDynamicLimit = async (options)=>{
        if (!this.dynamicLimits) {
            throw new Error("dynamicLimits must be enabled in the Ratelimit constructor to use setDynamicLimit()");
        }
        const globalKey = `${this.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}`;
        await (options.limit === false ? this.primaryRedis.del(globalKey) : this.primaryRedis.set(globalKey, options.limit));
    };
    /**
   * Get the current global dynamic rate limit.
   * 
   * @example
   * ```ts
   * const { dynamicLimit } = await ratelimit.getDynamicLimit();
   * console.log(dynamicLimit); // 120 or null if not set
   * ```
   * 
   * @returns Object containing the current global dynamic limit, or null if not set
   */ getDynamicLimit = async ()=>{
        if (!this.dynamicLimits) {
            throw new Error("dynamicLimits must be enabled in the Ratelimit constructor to use getDynamicLimit()");
        }
        const globalKey = `${this.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}`;
        const result = await this.primaryRedis.get(globalKey);
        return {
            dynamicLimit: result === null ? null : Number(result)
        };
    };
};
// src/multi.ts
function randomId() {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for(let i = 0; i < 16; i++){
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
var MultiRegionRatelimit = class extends Ratelimit {
    /**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithn of your choice.
   */ constructor(config){
        super({
            prefix: config.prefix,
            limiter: config.limiter,
            timeout: config.timeout,
            analytics: config.analytics,
            dynamicLimits: config.dynamicLimits,
            ctx: {
                regionContexts: config.redis.map((redis)=>({
                        redis,
                        prefix: config.prefix ?? DEFAULT_PREFIX
                    })),
                cache: config.ephemeralCache ? new Cache(config.ephemeralCache) : void 0
            }
        });
        if (config.dynamicLimits) {
            console.warn("Warning: Dynamic limits are not yet supported for multi-region rate limiters. The dynamicLimits option will be ignored.");
        }
    }
    /**
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */ static fixedWindow(tokens, window) {
        const windowDuration = ms(window);
        return ()=>({
                async limit (ctx, identifier, rate) {
                    const requestId = randomId();
                    const bucket = Math.floor(Date.now() / windowDuration);
                    const key = [
                        identifier,
                        bucket
                    ].join(":");
                    const incrementBy = rate ?? 1;
                    if (ctx.cache && incrementBy > 0) {
                        const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
                        if (blocked) {
                            return {
                                success: false,
                                limit: tokens,
                                remaining: 0,
                                reset: reset2,
                                pending: Promise.resolve(),
                                reason: "cacheBlock"
                            };
                        }
                    }
                    const dbs = ctx.regionContexts.map((regionContext)=>({
                            redis: regionContext.redis,
                            request: safeEval(regionContext, SCRIPTS.multiRegion.fixedWindow.limit, [
                                key
                            ], [
                                requestId,
                                windowDuration,
                                incrementBy
                            ])
                        }));
                    const firstResponse = await Promise.any(dbs.map((s)=>s.request));
                    const usedTokens = firstResponse.reduce((accTokens, usedToken, index)=>{
                        let parsedToken = 0;
                        if (index % 2) {
                            parsedToken = Number.parseInt(usedToken);
                        }
                        return accTokens + parsedToken;
                    }, 0);
                    const remaining = tokens - usedTokens;
                    async function sync() {
                        const individualIDs = await Promise.all(dbs.map((s)=>s.request));
                        const allIDs = [
                            ...new Set(individualIDs.flat().reduce((acc, curr, index)=>{
                                if (index % 2 === 0) {
                                    acc.push(curr);
                                }
                                return acc;
                            }, [])).values()
                        ];
                        for (const db of dbs){
                            const usedDbTokensRequest = await db.request;
                            const usedDbTokens = usedDbTokensRequest.reduce((accTokens, usedToken, index)=>{
                                let parsedToken = 0;
                                if (index % 2) {
                                    parsedToken = Number.parseInt(usedToken);
                                }
                                return accTokens + parsedToken;
                            }, 0);
                            const dbIdsRequest = await db.request;
                            const dbIds = dbIdsRequest.reduce((ids, currentId, index)=>{
                                if (index % 2 === 0) {
                                    ids.push(currentId);
                                }
                                return ids;
                            }, []);
                            if (usedDbTokens >= tokens) {
                                continue;
                            }
                            const diff = allIDs.filter((id)=>!dbIds.includes(id));
                            if (diff.length === 0) {
                                continue;
                            }
                            for (const requestId2 of diff){
                                await db.redis.hset(key, {
                                    [requestId2]: incrementBy
                                });
                            }
                        }
                    }
                    const success = remaining >= 0;
                    const reset = (bucket + 1) * windowDuration;
                    if (ctx.cache) {
                        if (!success) {
                            ctx.cache.blockUntil(identifier, reset);
                        } else if (incrementBy < 0) {
                            ctx.cache.pop(identifier);
                        }
                    }
                    return {
                        success,
                        limit: tokens,
                        remaining,
                        reset,
                        pending: sync()
                    };
                },
                async getRemaining (ctx, identifier) {
                    const bucket = Math.floor(Date.now() / windowDuration);
                    const key = [
                        identifier,
                        bucket
                    ].join(":");
                    const dbs = ctx.regionContexts.map((regionContext)=>({
                            redis: regionContext.redis,
                            request: safeEval(regionContext, SCRIPTS.multiRegion.fixedWindow.getRemaining, [
                                key
                            ], [
                                null
                            ])
                        }));
                    const firstResponse = await Promise.any(dbs.map((s)=>s.request));
                    const usedTokens = firstResponse.reduce((accTokens, usedToken, index)=>{
                        let parsedToken = 0;
                        if (index % 2) {
                            parsedToken = Number.parseInt(usedToken);
                        }
                        return accTokens + parsedToken;
                    }, 0);
                    return {
                        remaining: Math.max(0, tokens - usedTokens),
                        reset: (bucket + 1) * windowDuration,
                        limit: tokens
                    };
                },
                async resetTokens (ctx, identifier) {
                    const pattern = [
                        identifier,
                        "*"
                    ].join(":");
                    if (ctx.cache) {
                        ctx.cache.pop(identifier);
                    }
                    await Promise.all(ctx.regionContexts.map((regionContext)=>{
                        safeEval(regionContext, RESET_SCRIPT, [
                            pattern
                        ], [
                            null
                        ]);
                    }));
                }
            });
    }
    /**
   * Combined approach of `slidingLogs` and `fixedWindow` with lower storage
   * costs than `slidingLogs` and improved boundary behavior by calculating a
   * weighted score between two windows.
   *
   * **Pro:**
   *
   * Good performance allows this to scale to very high loads.
   *
   * **Con:**
   *
   * Nothing major.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - The duration in which the user can max X requests.
   */ static slidingWindow(tokens, window) {
        const windowSize = ms(window);
        const windowDuration = ms(window);
        return ()=>({
                async limit (ctx, identifier, rate) {
                    const requestId = randomId();
                    const now = Date.now();
                    const currentWindow = Math.floor(now / windowSize);
                    const currentKey = [
                        identifier,
                        currentWindow
                    ].join(":");
                    const previousWindow = currentWindow - 1;
                    const previousKey = [
                        identifier,
                        previousWindow
                    ].join(":");
                    const incrementBy = rate ?? 1;
                    if (ctx.cache && incrementBy > 0) {
                        const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
                        if (blocked) {
                            return {
                                success: false,
                                limit: tokens,
                                remaining: 0,
                                reset: reset2,
                                pending: Promise.resolve(),
                                reason: "cacheBlock"
                            };
                        }
                    }
                    const dbs = ctx.regionContexts.map((regionContext)=>({
                            redis: regionContext.redis,
                            request: safeEval(regionContext, SCRIPTS.multiRegion.slidingWindow.limit, [
                                currentKey,
                                previousKey
                            ], [
                                tokens,
                                now,
                                windowDuration,
                                requestId,
                                incrementBy
                            ])
                        }));
                    const percentageInCurrent = now % windowDuration / windowDuration;
                    const [current, previous, success] = await Promise.any(dbs.map((s)=>s.request));
                    if (success) {
                        current.push(requestId, incrementBy.toString());
                    }
                    const previousUsedTokens = previous.reduce((accTokens, usedToken, index)=>{
                        let parsedToken = 0;
                        if (index % 2) {
                            parsedToken = Number.parseInt(usedToken);
                        }
                        return accTokens + parsedToken;
                    }, 0);
                    const currentUsedTokens = current.reduce((accTokens, usedToken, index)=>{
                        let parsedToken = 0;
                        if (index % 2) {
                            parsedToken = Number.parseInt(usedToken);
                        }
                        return accTokens + parsedToken;
                    }, 0);
                    const previousPartialUsed = Math.ceil(previousUsedTokens * (1 - percentageInCurrent));
                    const usedTokens = previousPartialUsed + currentUsedTokens;
                    const remaining = tokens - usedTokens;
                    async function sync() {
                        const res = await Promise.all(dbs.map((s)=>s.request));
                        const allCurrentIds = [
                            ...new Set(res.flatMap(([current2])=>current2).reduce((acc, curr, index)=>{
                                if (index % 2 === 0) {
                                    acc.push(curr);
                                }
                                return acc;
                            }, [])).values()
                        ];
                        for (const db of dbs){
                            const [current2, _previous, _success] = await db.request;
                            const dbIds = current2.reduce((ids, currentId, index)=>{
                                if (index % 2 === 0) {
                                    ids.push(currentId);
                                }
                                return ids;
                            }, []);
                            const usedDbTokens = current2.reduce((accTokens, usedToken, index)=>{
                                let parsedToken = 0;
                                if (index % 2) {
                                    parsedToken = Number.parseInt(usedToken);
                                }
                                return accTokens + parsedToken;
                            }, 0);
                            if (usedDbTokens >= tokens) {
                                continue;
                            }
                            const diff = allCurrentIds.filter((id)=>!dbIds.includes(id));
                            if (diff.length === 0) {
                                continue;
                            }
                            for (const requestId2 of diff){
                                await db.redis.hset(currentKey, {
                                    [requestId2]: incrementBy
                                });
                            }
                        }
                    }
                    const reset = (currentWindow + 1) * windowDuration;
                    if (ctx.cache) {
                        if (!success) {
                            ctx.cache.blockUntil(identifier, reset);
                        } else if (incrementBy < 0) {
                            ctx.cache.pop(identifier);
                        }
                    }
                    return {
                        success: Boolean(success),
                        limit: tokens,
                        remaining: Math.max(0, remaining),
                        reset,
                        pending: sync()
                    };
                },
                async getRemaining (ctx, identifier) {
                    const now = Date.now();
                    const currentWindow = Math.floor(now / windowSize);
                    const currentKey = [
                        identifier,
                        currentWindow
                    ].join(":");
                    const previousWindow = currentWindow - 1;
                    const previousKey = [
                        identifier,
                        previousWindow
                    ].join(":");
                    const dbs = ctx.regionContexts.map((regionContext)=>({
                            redis: regionContext.redis,
                            request: safeEval(regionContext, SCRIPTS.multiRegion.slidingWindow.getRemaining, [
                                currentKey,
                                previousKey
                            ], [
                                now,
                                windowSize
                            ])
                        }));
                    const usedTokens = await Promise.any(dbs.map((s)=>s.request));
                    return {
                        remaining: Math.max(0, tokens - usedTokens),
                        reset: (currentWindow + 1) * windowSize,
                        limit: tokens
                    };
                },
                async resetTokens (ctx, identifier) {
                    const pattern = [
                        identifier,
                        "*"
                    ].join(":");
                    if (ctx.cache) {
                        ctx.cache.pop(identifier);
                    }
                    await Promise.all(ctx.regionContexts.map((regionContext)=>{
                        safeEval(regionContext, RESET_SCRIPT, [
                            pattern
                        ], [
                            null
                        ]);
                    }));
                }
            });
    }
};
// src/single.ts
var RegionRatelimit = class extends Ratelimit {
    /**
   * Create a new Ratelimit instance by providing a `@upstash/redis` instance and the algorithm of your choice.
   */ constructor(config){
        super({
            prefix: config.prefix,
            limiter: config.limiter,
            timeout: config.timeout,
            analytics: config.analytics,
            ctx: {
                redis: config.redis,
                prefix: config.prefix ?? DEFAULT_PREFIX
            },
            ephemeralCache: config.ephemeralCache,
            enableProtection: config.enableProtection,
            denyListThreshold: config.denyListThreshold,
            dynamicLimits: config.dynamicLimits
        });
    }
    /**
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */ static fixedWindow(tokens, window) {
        const windowDuration = ms(window);
        return ()=>({
                async limit (ctx, identifier, rate) {
                    const bucket = Math.floor(Date.now() / windowDuration);
                    const key = [
                        identifier,
                        bucket
                    ].join(":");
                    const incrementBy = rate ?? 1;
                    if (ctx.cache && incrementBy > 0) {
                        const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
                        if (blocked) {
                            return {
                                success: false,
                                limit: tokens,
                                remaining: 0,
                                reset: reset2,
                                pending: Promise.resolve(),
                                reason: "cacheBlock"
                            };
                        }
                    }
                    const dynamicLimitKey = ctx.dynamicLimits ? `${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}` : "";
                    const [usedTokensAfterUpdate, effectiveLimit] = await safeEval(ctx, SCRIPTS.singleRegion.fixedWindow.limit, [
                        key,
                        dynamicLimitKey
                    ], [
                        tokens,
                        windowDuration,
                        incrementBy
                    ]);
                    const success = usedTokensAfterUpdate <= effectiveLimit;
                    const remainingTokens = Math.max(0, effectiveLimit - usedTokensAfterUpdate);
                    const reset = (bucket + 1) * windowDuration;
                    if (ctx.cache) {
                        if (!success) {
                            ctx.cache.blockUntil(identifier, reset);
                        } else if (incrementBy < 0) {
                            ctx.cache.pop(identifier);
                        }
                    }
                    return {
                        success,
                        limit: effectiveLimit,
                        remaining: remainingTokens,
                        reset,
                        pending: Promise.resolve()
                    };
                },
                async getRemaining (ctx, identifier) {
                    const bucket = Math.floor(Date.now() / windowDuration);
                    const key = [
                        identifier,
                        bucket
                    ].join(":");
                    const dynamicLimitKey = ctx.dynamicLimits ? `${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}` : "";
                    const [remaining, effectiveLimit] = await safeEval(ctx, SCRIPTS.singleRegion.fixedWindow.getRemaining, [
                        key,
                        dynamicLimitKey
                    ], [
                        tokens
                    ]);
                    return {
                        remaining: Math.max(0, remaining),
                        reset: (bucket + 1) * windowDuration,
                        limit: effectiveLimit
                    };
                },
                async resetTokens (ctx, identifier) {
                    const pattern = [
                        identifier,
                        "*"
                    ].join(":");
                    if (ctx.cache) {
                        ctx.cache.pop(identifier);
                    }
                    await safeEval(ctx, RESET_SCRIPT, [
                        pattern
                    ], [
                        null
                    ]);
                }
            });
    }
    /**
   * Combined approach of `slidingLogs` and `fixedWindow` with lower storage
   * costs than `slidingLogs` and improved boundary behavior by calculating a
   * weighted score between two windows.
   *
   * **Pro:**
   *
   * Good performance allows this to scale to very high loads.
   *
   * **Con:**
   *
   * Nothing major.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - The duration in which the user can max X requests.
   */ static slidingWindow(tokens, window) {
        const windowSize = ms(window);
        return ()=>({
                async limit (ctx, identifier, rate) {
                    const now = Date.now();
                    const currentWindow = Math.floor(now / windowSize);
                    const currentKey = [
                        identifier,
                        currentWindow
                    ].join(":");
                    const previousWindow = currentWindow - 1;
                    const previousKey = [
                        identifier,
                        previousWindow
                    ].join(":");
                    const incrementBy = rate ?? 1;
                    if (ctx.cache && incrementBy > 0) {
                        const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
                        if (blocked) {
                            return {
                                success: false,
                                limit: tokens,
                                remaining: 0,
                                reset: reset2,
                                pending: Promise.resolve(),
                                reason: "cacheBlock"
                            };
                        }
                    }
                    const dynamicLimitKey = ctx.dynamicLimits ? `${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}` : "";
                    const [remainingTokens, effectiveLimit] = await safeEval(ctx, SCRIPTS.singleRegion.slidingWindow.limit, [
                        currentKey,
                        previousKey,
                        dynamicLimitKey
                    ], [
                        tokens,
                        now,
                        windowSize,
                        incrementBy
                    ]);
                    const success = remainingTokens >= 0;
                    const reset = (currentWindow + 1) * windowSize;
                    if (ctx.cache) {
                        if (!success) {
                            ctx.cache.blockUntil(identifier, reset);
                        } else if (incrementBy < 0) {
                            ctx.cache.pop(identifier);
                        }
                    }
                    return {
                        success,
                        limit: effectiveLimit,
                        remaining: Math.max(0, remainingTokens),
                        reset,
                        pending: Promise.resolve()
                    };
                },
                async getRemaining (ctx, identifier) {
                    const now = Date.now();
                    const currentWindow = Math.floor(now / windowSize);
                    const currentKey = [
                        identifier,
                        currentWindow
                    ].join(":");
                    const previousWindow = currentWindow - 1;
                    const previousKey = [
                        identifier,
                        previousWindow
                    ].join(":");
                    const dynamicLimitKey = ctx.dynamicLimits ? `${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}` : "";
                    const [remaining, effectiveLimit] = await safeEval(ctx, SCRIPTS.singleRegion.slidingWindow.getRemaining, [
                        currentKey,
                        previousKey,
                        dynamicLimitKey
                    ], [
                        tokens,
                        now,
                        windowSize
                    ]);
                    return {
                        remaining: Math.max(0, remaining),
                        reset: (currentWindow + 1) * windowSize,
                        limit: effectiveLimit
                    };
                },
                async resetTokens (ctx, identifier) {
                    const pattern = [
                        identifier,
                        "*"
                    ].join(":");
                    if (ctx.cache) {
                        ctx.cache.pop(identifier);
                    }
                    await safeEval(ctx, RESET_SCRIPT, [
                        pattern
                    ], [
                        null
                    ]);
                }
            });
    }
    /**
   * You have a bucket filled with `{maxTokens}` tokens that refills constantly
   * at `{refillRate}` per `{interval}`.
   * Every request will remove one token from the bucket and if there is no
   * token to take, the request is rejected.
   *
   * **Pro:**
   *
   * - Bursts of requests are smoothed out and you can process them at a constant
   * rate.
   * - Allows to set a higher initial burst limit by setting `maxTokens` higher
   * than `refillRate`
   */ static tokenBucket(refillRate, interval, maxTokens) {
        const intervalDuration = ms(interval);
        return ()=>({
                async limit (ctx, identifier, rate) {
                    const now = Date.now();
                    const incrementBy = rate ?? 1;
                    if (ctx.cache && incrementBy > 0) {
                        const { blocked, reset: reset2 } = ctx.cache.isBlocked(identifier);
                        if (blocked) {
                            return {
                                success: false,
                                limit: maxTokens,
                                remaining: 0,
                                reset: reset2,
                                pending: Promise.resolve(),
                                reason: "cacheBlock"
                            };
                        }
                    }
                    const dynamicLimitKey = ctx.dynamicLimits ? `${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}` : "";
                    const [remaining, reset, effectiveLimit] = await safeEval(ctx, SCRIPTS.singleRegion.tokenBucket.limit, [
                        identifier,
                        dynamicLimitKey
                    ], [
                        maxTokens,
                        intervalDuration,
                        refillRate,
                        now,
                        incrementBy
                    ]);
                    const success = remaining >= 0;
                    if (ctx.cache) {
                        if (!success) {
                            ctx.cache.blockUntil(identifier, reset);
                        } else if (incrementBy < 0) {
                            ctx.cache.pop(identifier);
                        }
                    }
                    return {
                        success,
                        limit: effectiveLimit,
                        remaining: Math.max(0, remaining),
                        reset,
                        pending: Promise.resolve()
                    };
                },
                async getRemaining (ctx, identifier) {
                    const dynamicLimitKey = ctx.dynamicLimits ? `${ctx.prefix}${DYNAMIC_LIMIT_KEY_SUFFIX}` : "";
                    const [remainingTokens, refilledAt, effectiveLimit] = await safeEval(ctx, SCRIPTS.singleRegion.tokenBucket.getRemaining, [
                        identifier,
                        dynamicLimitKey
                    ], [
                        maxTokens
                    ]);
                    const freshRefillAt = Date.now() + intervalDuration;
                    const identifierRefillsAt = refilledAt + intervalDuration;
                    return {
                        remaining: Math.max(0, remainingTokens),
                        reset: refilledAt === tokenBucketIdentifierNotFound ? freshRefillAt : identifierRefillsAt,
                        limit: effectiveLimit
                    };
                },
                async resetTokens (ctx, identifier) {
                    const pattern = identifier;
                    if (ctx.cache) {
                        ctx.cache.pop(identifier);
                    }
                    await safeEval(ctx, RESET_SCRIPT, [
                        pattern
                    ], [
                        null
                    ]);
                }
            });
    }
    /**
   * cachedFixedWindow first uses the local cache to decide if a request may pass and then updates
   * it asynchronously.
   * This is experimental and not yet recommended for production use.
   *
   * @experimental
   *
   * Each request inside a fixed time increases a counter.
   * Once the counter reaches the maximum allowed number, all further requests are
   * rejected.
   *
   * **Pro:**
   *
   * - Newer requests are not starved by old ones.
   * - Low storage cost.
   *
   * **Con:**
   *
   * A burst of requests near the boundary of a window can result in a very
   * high request rate because two windows will be filled with requests quickly.
   *
   * @param tokens - How many requests a user can make in each time window.
   * @param window - A fixed timeframe
   */ static cachedFixedWindow(tokens, window) {
        const windowDuration = ms(window);
        return ()=>({
                async limit (ctx, identifier, rate) {
                    if (!ctx.cache) {
                        throw new Error("This algorithm requires a cache");
                    }
                    if (ctx.dynamicLimits) {
                        console.warn("Warning: Dynamic limits are not yet supported for cachedFixedWindow algorithm. The dynamicLimits option will be ignored.");
                    }
                    const bucket = Math.floor(Date.now() / windowDuration);
                    const key = [
                        identifier,
                        bucket
                    ].join(":");
                    const reset = (bucket + 1) * windowDuration;
                    const incrementBy = rate ?? 1;
                    const hit = typeof ctx.cache.get(key) === "number";
                    if (hit) {
                        const cachedTokensAfterUpdate = ctx.cache.incr(key, incrementBy);
                        const success = cachedTokensAfterUpdate < tokens;
                        const pending = success ? safeEval(ctx, SCRIPTS.singleRegion.cachedFixedWindow.limit, [
                            key
                        ], [
                            windowDuration,
                            incrementBy
                        ]) : Promise.resolve();
                        return {
                            success,
                            limit: tokens,
                            remaining: tokens - cachedTokensAfterUpdate,
                            reset,
                            pending
                        };
                    }
                    const usedTokensAfterUpdate = await safeEval(ctx, SCRIPTS.singleRegion.cachedFixedWindow.limit, [
                        key
                    ], [
                        windowDuration,
                        incrementBy
                    ]);
                    ctx.cache.set(key, usedTokensAfterUpdate);
                    const remaining = tokens - usedTokensAfterUpdate;
                    return {
                        success: remaining >= 0,
                        limit: tokens,
                        remaining,
                        reset,
                        pending: Promise.resolve()
                    };
                },
                async getRemaining (ctx, identifier) {
                    if (!ctx.cache) {
                        throw new Error("This algorithm requires a cache");
                    }
                    const bucket = Math.floor(Date.now() / windowDuration);
                    const key = [
                        identifier,
                        bucket
                    ].join(":");
                    const hit = typeof ctx.cache.get(key) === "number";
                    if (hit) {
                        const cachedUsedTokens = ctx.cache.get(key) ?? 0;
                        return {
                            remaining: Math.max(0, tokens - cachedUsedTokens),
                            reset: (bucket + 1) * windowDuration,
                            limit: tokens
                        };
                    }
                    const usedTokens = await safeEval(ctx, SCRIPTS.singleRegion.cachedFixedWindow.getRemaining, [
                        key
                    ], [
                        null
                    ]);
                    return {
                        remaining: Math.max(0, tokens - usedTokens),
                        reset: (bucket + 1) * windowDuration,
                        limit: tokens
                    };
                },
                async resetTokens (ctx, identifier) {
                    if (!ctx.cache) {
                        throw new Error("This algorithm requires a cache");
                    }
                    const bucket = Math.floor(Date.now() / windowDuration);
                    const key = [
                        identifier,
                        bucket
                    ].join(":");
                    ctx.cache.pop(key);
                    const pattern = [
                        identifier,
                        "*"
                    ].join(":");
                    await safeEval(ctx, RESET_SCRIPT, [
                        pattern
                    ], [
                        null
                    ]);
                }
            });
    }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
    Analytics,
    IpDenyList,
    MultiRegionRatelimit,
    Ratelimit
});
}),
"[project]/node_modules/uncrypto/dist/crypto.node.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>_crypto,
    "getRandomValues",
    ()=>getRandomValues,
    "randomUUID",
    ()=>randomUUID,
    "subtle",
    ()=>subtle
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
const subtle = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].webcrypto?.subtle || {};
const randomUUID = ()=>{
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].randomUUID();
};
const getRandomValues = (array)=>{
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].webcrypto.getRandomValues(array);
};
const _crypto = {
    randomUUID,
    getRandomValues,
    subtle
};
;
}),
"[project]/node_modules/uuid/dist/esm-node/index.js [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
;
;
;
;
;
;
;
;
;
;
;
;
}),
"[project]/node_modules/uuid/dist/esm-node/max.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
}),
"[project]/node_modules/uuid/dist/esm-node/nil.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = '00000000-0000-0000-0000-000000000000';
}),
"[project]/node_modules/uuid/dist/esm-node/regex.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
}),
"[project]/node_modules/uuid/dist/esm-node/validate.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$regex$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/regex.js [app-route] (ecmascript)");
;
function validate(uuid) {
    return typeof uuid === 'string' && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$regex$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].test(uuid);
}
const __TURBOPACK__default__export__ = validate;
}),
"[project]/node_modules/uuid/dist/esm-node/parse.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/validate.js [app-route] (ecmascript)");
;
function parse(uuid) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(uuid)) {
        throw TypeError('Invalid UUID');
    }
    let v;
    const arr = new Uint8Array(16);
    // Parse ########-....-....-....-............
    arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
    arr[1] = v >>> 16 & 0xff;
    arr[2] = v >>> 8 & 0xff;
    arr[3] = v & 0xff;
    // Parse ........-####-....-....-............
    arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
    arr[5] = v & 0xff;
    // Parse ........-....-####-....-............
    arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
    arr[7] = v & 0xff;
    // Parse ........-....-....-####-............
    arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
    arr[9] = v & 0xff;
    // Parse ........-....-....-....-############
    // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)
    arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
    arr[11] = v / 0x100000000 & 0xff;
    arr[12] = v >>> 24 & 0xff;
    arr[13] = v >>> 16 & 0xff;
    arr[14] = v >>> 8 & 0xff;
    arr[15] = v & 0xff;
    return arr;
}
const __TURBOPACK__default__export__ = parse;
}),
"[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "unsafeStringify",
    ()=>unsafeStringify
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/validate.js [app-route] (ecmascript)");
;
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */ const byteToHex = [];
for(let i = 0; i < 256; ++i){
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
    // Note: Be careful editing this code!  It's been tuned for performance
    // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
    //
    // Note to future-self: No, you can't remove the `toLowerCase()` call.
    // REF: https://github.com/uuidjs/uuid/pull/677#issuecomment-1757351351
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset);
    // Consistency check for valid UUID.  If this throws, it's likely due to one
    // of the following:
    // - One or more input array values don't map to a hex octet (leading to
    // "undefined" in the uuid)
    // - Invalid input values for the RFC `version` or `variant` fields
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(uuid)) {
        throw TypeError('Stringified UUID is invalid');
    }
    return uuid;
}
const __TURBOPACK__default__export__ = stringify;
}),
"[project]/node_modules/uuid/dist/esm-node/rng.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>rng
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
const rnds8Pool = new Uint8Array(256); // # of random values to pre-allocate
let poolPtr = rnds8Pool.length;
function rng() {
    if (poolPtr > rnds8Pool.length - 16) {
        __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].randomFillSync(rnds8Pool);
        poolPtr = 0;
    }
    return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
}),
"[project]/node_modules/uuid/dist/esm-node/v1.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/rng.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
;
;
// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;
let _clockseq;
// Previous uuid creation time
let _lastMSecs = 0;
let _lastNSecs = 0;
// See https://github.com/uuidjs/uuid for API details
function v1(options, buf, offset) {
    let i = buf && offset || 0;
    const b = buf || new Array(16);
    options = options || {};
    let node = options.node;
    let clockseq = options.clockseq;
    // v1 only: Use cached `node` and `clockseq` values
    if (!options._v6) {
        if (!node) {
            node = _nodeId;
        }
        if (clockseq == null) {
            clockseq = _clockseq;
        }
    }
    // Handle cases where we need entropy.  We do this lazily to minimize issues
    // related to insufficient system entropy.  See #189
    if (node == null || clockseq == null) {
        const seedBytes = options.random || (options.rng || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])();
        // Randomize node
        if (node == null) {
            node = [
                seedBytes[0],
                seedBytes[1],
                seedBytes[2],
                seedBytes[3],
                seedBytes[4],
                seedBytes[5]
            ];
            // v1 only: cache node value for reuse
            if (!_nodeId && !options._v6) {
                // per RFC4122 4.5: Set MAC multicast bit (v1 only)
                node[0] |= 0x01; // Set multicast bit
                _nodeId = node;
            }
        }
        // Randomize clockseq
        if (clockseq == null) {
            // Per 4.2.2, randomize (14 bit) clockseq
            clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
            if (_clockseq === undefined && !options._v6) {
                _clockseq = clockseq;
            }
        }
    }
    // v1 & v6 timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so time is
    // handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    let msecs = options.msecs !== undefined ? options.msecs : Date.now();
    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1;
    // Time since last uuid creation (in msecs)
    const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000;
    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq === undefined) {
        clockseq = clockseq + 1 & 0x3fff;
    }
    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
        nsecs = 0;
    }
    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
        throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
    }
    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;
    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;
    // `time_low`
    const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;
    // `time_mid`
    const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;
    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;
    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;
    // `clock_seq_low`
    b[i++] = clockseq & 0xff;
    // `node`
    for(let n = 0; n < 6; ++n){
        b[i + n] = node[n];
    }
    return buf || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unsafeStringify"])(b);
}
const __TURBOPACK__default__export__ = v1;
}),
"[project]/node_modules/uuid/dist/esm-node/v1ToV6.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>v1ToV6
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/parse.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
;
;
function v1ToV6(uuid) {
    const v1Bytes = typeof uuid === 'string' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(uuid) : uuid;
    const v6Bytes = _v1ToV6(v1Bytes);
    return typeof uuid === 'string' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unsafeStringify"])(v6Bytes) : v6Bytes;
}
// Do the field transformation needed for v1 -> v6
function _v1ToV6(v1Bytes, randomize = false) {
    return Uint8Array.of((v1Bytes[6] & 0x0f) << 4 | v1Bytes[7] >> 4 & 0x0f, (v1Bytes[7] & 0x0f) << 4 | (v1Bytes[4] & 0xf0) >> 4, (v1Bytes[4] & 0x0f) << 4 | (v1Bytes[5] & 0xf0) >> 4, (v1Bytes[5] & 0x0f) << 4 | (v1Bytes[0] & 0xf0) >> 4, (v1Bytes[0] & 0x0f) << 4 | (v1Bytes[1] & 0xf0) >> 4, (v1Bytes[1] & 0x0f) << 4 | (v1Bytes[2] & 0xf0) >> 4, 0x60 | v1Bytes[2] & 0x0f, v1Bytes[3], v1Bytes[8], v1Bytes[9], v1Bytes[10], v1Bytes[11], v1Bytes[12], v1Bytes[13], v1Bytes[14], v1Bytes[15]);
}
}),
"[project]/node_modules/uuid/dist/esm-node/v35.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DNS",
    ()=>DNS,
    "URL",
    ()=>URL,
    "default",
    ()=>v35
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/parse.js [app-route] (ecmascript)");
;
;
function stringToBytes(str) {
    str = unescape(encodeURIComponent(str)); // UTF8 escape
    const bytes = [];
    for(let i = 0; i < str.length; ++i){
        bytes.push(str.charCodeAt(i));
    }
    return bytes;
}
const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35(name, version, hashfunc) {
    function generateUUID(value, namespace, buf, offset) {
        var _namespace;
        if (typeof value === 'string') {
            value = stringToBytes(value);
        }
        if (typeof namespace === 'string') {
            namespace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(namespace);
        }
        if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
            throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
        }
        // Compute hash of namespace and value, Per 4.3
        // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
        // hashfunc([...namespace, ... value])`
        let bytes = new Uint8Array(16 + value.length);
        bytes.set(namespace);
        bytes.set(value, namespace.length);
        bytes = hashfunc(bytes);
        bytes[6] = bytes[6] & 0x0f | version;
        bytes[8] = bytes[8] & 0x3f | 0x80;
        if (buf) {
            offset = offset || 0;
            for(let i = 0; i < 16; ++i){
                buf[offset + i] = bytes[i];
            }
            return buf;
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unsafeStringify"])(bytes);
    }
    // Function#name is not settable on some platforms (#270)
    try {
        generateUUID.name = name;
    } catch (err) {}
    // For CommonJS default export support
    generateUUID.DNS = DNS;
    generateUUID.URL = URL;
    return generateUUID;
}
}),
"[project]/node_modules/uuid/dist/esm-node/md5.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
function md5(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    } else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createHash('md5').update(bytes).digest();
}
const __TURBOPACK__default__export__ = md5;
}),
"[project]/node_modules/uuid/dist/esm-node/v3.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v35$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v35.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$md5$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/md5.js [app-route] (ecmascript)");
;
;
const v3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v35$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])('v3', 0x30, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$md5$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"]);
const __TURBOPACK__default__export__ = v3;
}),
"[project]/node_modules/uuid/dist/esm-node/native.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
const __TURBOPACK__default__export__ = {
    randomUUID: __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].randomUUID
};
}),
"[project]/node_modules/uuid/dist/esm-node/v4.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$native$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/native.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/rng.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
;
;
;
function v4(options, buf, offset) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$native$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].randomUUID && !buf && !options) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$native$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].randomUUID();
    }
    options = options || {};
    const rnds = options.random || (options.rng || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])();
    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80;
    // Copy bytes to buffer, if provided
    if (buf) {
        offset = offset || 0;
        for(let i = 0; i < 16; ++i){
            buf[offset + i] = rnds[i];
        }
        return buf;
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unsafeStringify"])(rnds);
}
const __TURBOPACK__default__export__ = v4;
}),
"[project]/node_modules/uuid/dist/esm-node/sha1.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
function sha1(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    } else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }
    return __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].createHash('sha1').update(bytes).digest();
}
const __TURBOPACK__default__export__ = sha1;
}),
"[project]/node_modules/uuid/dist/esm-node/v5.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v35$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v35.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$sha1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/sha1.js [app-route] (ecmascript)");
;
;
const v5 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v35$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])('v5', 0x50, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$sha1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"]);
const __TURBOPACK__default__export__ = v5;
}),
"[project]/node_modules/uuid/dist/esm-node/v6.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>v6
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v1.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1ToV6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v1ToV6.js [app-route] (ecmascript)");
;
;
;
function v6(options = {}, buf, offset = 0) {
    // v6 is v1 with different field layout, so we start with a v1 UUID, albeit
    // with slightly different behavior around how the clock_seq and node fields
    // are randomized, which is why we call v1 with _v6: true.
    let bytes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])({
        ...options,
        _v6: true
    }, new Uint8Array(16));
    // Reorder the fields to v6 layout.
    bytes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1ToV6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(bytes);
    // Return as a byte array if requested
    if (buf) {
        for(let i = 0; i < 16; i++){
            buf[offset + i] = bytes[i];
        }
        return buf;
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unsafeStringify"])(bytes);
}
}),
"[project]/node_modules/uuid/dist/esm-node/v6ToV1.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>v6ToV1
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/parse.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
;
;
function v6ToV1(uuid) {
    const v6Bytes = typeof uuid === 'string' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(uuid) : uuid;
    const v1Bytes = _v6ToV1(v6Bytes);
    return typeof uuid === 'string' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unsafeStringify"])(v1Bytes) : v1Bytes;
}
// Do the field transformation needed for v6 -> v1
function _v6ToV1(v6Bytes) {
    return Uint8Array.of((v6Bytes[3] & 0x0f) << 4 | v6Bytes[4] >> 4 & 0x0f, (v6Bytes[4] & 0x0f) << 4 | (v6Bytes[5] & 0xf0) >> 4, (v6Bytes[5] & 0x0f) << 4 | v6Bytes[6] & 0x0f, v6Bytes[7], (v6Bytes[1] & 0x0f) << 4 | (v6Bytes[2] & 0xf0) >> 4, (v6Bytes[2] & 0x0f) << 4 | (v6Bytes[3] & 0xf0) >> 4, 0x10 | (v6Bytes[0] & 0xf0) >> 4, (v6Bytes[0] & 0x0f) << 4 | (v6Bytes[1] & 0xf0) >> 4, v6Bytes[8], v6Bytes[9], v6Bytes[10], v6Bytes[11], v6Bytes[12], v6Bytes[13], v6Bytes[14], v6Bytes[15]);
}
}),
"[project]/node_modules/uuid/dist/esm-node/v7.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/rng.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
;
;
/**
 * UUID V7 - Unix Epoch time-based UUID
 *
 * The IETF has published RFC9562, introducing 3 new UUID versions (6,7,8). This
 * implementation of V7 is based on the accepted, though not yet approved,
 * revisions.
 *
 * RFC 9562:https://www.rfc-editor.org/rfc/rfc9562.html Universally Unique
 * IDentifiers (UUIDs)

 *
 * Sample V7 value:
 * https://www.rfc-editor.org/rfc/rfc9562.html#name-example-of-a-uuidv7-value
 *
 * Monotonic Bit Layout: RFC rfc9562.6.2 Method 1, Dedicated Counter Bits ref:
 *     https://www.rfc-editor.org/rfc/rfc9562.html#section-6.2-5.1
 *
 *   0                   1                   2                   3 0 1 2 3 4 5 6
 *   7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |                          unix_ts_ms                           |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |          unix_ts_ms           |  ver  |        seq_hi         |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |var|               seq_low               |        rand         |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |                             rand                              |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *
 * seq is a 31 bit serialized counter; comprised of 12 bit seq_hi and 19 bit
 * seq_low, and randomly initialized upon timestamp change. 31 bit counter size
 * was selected as any bitwise operations in node are done as _signed_ 32 bit
 * ints. we exclude the sign bit.
 */ let _seqLow = null;
let _seqHigh = null;
let _msecs = 0;
function v7(options, buf, offset) {
    options = options || {};
    // initialize buffer and pointer
    let i = buf && offset || 0;
    const b = buf || new Uint8Array(16);
    // rnds is Uint8Array(16) filled with random bytes
    const rnds = options.random || (options.rng || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])();
    // milliseconds since unix epoch, 1970-01-01 00:00
    const msecs = options.msecs !== undefined ? options.msecs : Date.now();
    // seq is user provided 31 bit counter
    let seq = options.seq !== undefined ? options.seq : null;
    // initialize local seq high/low parts
    let seqHigh = _seqHigh;
    let seqLow = _seqLow;
    // check if clock has advanced and user has not provided msecs
    if (msecs > _msecs && options.msecs === undefined) {
        _msecs = msecs;
        // unless user provided seq, reset seq parts
        if (seq !== null) {
            seqHigh = null;
            seqLow = null;
        }
    }
    // if we have a user provided seq
    if (seq !== null) {
        // trim provided seq to 31 bits of value, avoiding overflow
        if (seq > 0x7fffffff) {
            seq = 0x7fffffff;
        }
        // split provided seq into high/low parts
        seqHigh = seq >>> 19 & 0xfff;
        seqLow = seq & 0x7ffff;
    }
    // randomly initialize seq
    if (seqHigh === null || seqLow === null) {
        seqHigh = rnds[6] & 0x7f;
        seqHigh = seqHigh << 8 | rnds[7];
        seqLow = rnds[8] & 0x3f; // pad for var
        seqLow = seqLow << 8 | rnds[9];
        seqLow = seqLow << 5 | rnds[10] >>> 3;
    }
    // increment seq if within msecs window
    if (msecs + 10000 > _msecs && seq === null) {
        if (++seqLow > 0x7ffff) {
            seqLow = 0;
            if (++seqHigh > 0xfff) {
                seqHigh = 0;
                // increment internal _msecs. this allows us to continue incrementing
                // while staying monotonic. Note, once we hit 10k milliseconds beyond system
                // clock, we will reset breaking monotonicity (after (2^31)*10000 generations)
                _msecs++;
            }
        }
    } else {
        // resetting; we have advanced more than
        // 10k milliseconds beyond system clock
        _msecs = msecs;
    }
    _seqHigh = seqHigh;
    _seqLow = seqLow;
    // [bytes 0-5] 48 bits of local timestamp
    b[i++] = _msecs / 0x10000000000 & 0xff;
    b[i++] = _msecs / 0x100000000 & 0xff;
    b[i++] = _msecs / 0x1000000 & 0xff;
    b[i++] = _msecs / 0x10000 & 0xff;
    b[i++] = _msecs / 0x100 & 0xff;
    b[i++] = _msecs & 0xff;
    // [byte 6] - set 4 bits of version (7) with first 4 bits seq_hi
    b[i++] = seqHigh >>> 4 & 0x0f | 0x70;
    // [byte 7] remaining 8 bits of seq_hi
    b[i++] = seqHigh & 0xff;
    // [byte 8] - variant (2 bits), first 6 bits seq_low
    b[i++] = seqLow >>> 13 & 0x3f | 0x80;
    // [byte 9] 8 bits seq_low
    b[i++] = seqLow >>> 5 & 0xff;
    // [byte 10] remaining 5 bits seq_low, 3 bits random
    b[i++] = seqLow << 3 & 0xff | rnds[10] & 0x07;
    // [bytes 11-15] always random
    b[i++] = rnds[11];
    b[i++] = rnds[12];
    b[i++] = rnds[13];
    b[i++] = rnds[14];
    b[i++] = rnds[15];
    return buf || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["unsafeStringify"])(b);
}
const __TURBOPACK__default__export__ = v7;
}),
"[project]/node_modules/uuid/dist/esm-node/version.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/validate.js [app-route] (ecmascript)");
;
function version(uuid) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(uuid)) {
        throw TypeError('Invalid UUID');
    }
    return parseInt(uuid.slice(14, 15), 16);
}
const __TURBOPACK__default__export__ = version;
}),
"[project]/node_modules/uuid/dist/esm-node/index.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MAX",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$max$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "NIL",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$nil$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "parse",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "stringify",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v1ToV6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1ToV6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v3",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v3$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v4",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v4$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v5",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v5$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v6",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v6ToV1",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v6ToV1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "v7",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v7$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "validate",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"],
    "version",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$version$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$max$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/max.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$nil$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/nil.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$parse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/parse.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/stringify.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v1.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v1ToV6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v1ToV6.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v3$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v3.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v4$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v4.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v5$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v5.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v6$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v6.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v6ToV1$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v6ToV1.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v7$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/v7.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/validate.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$version$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/uuid/dist/esm-node/version.js [app-route] (ecmascript)");
}),
"[project]/node_modules/standardwebhooks/dist/timing_safe_equal.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.timingSafeEqual = void 0;
function assert(expr, msg = "") {
    if (!expr) {
        throw new Error(msg);
    }
}
function timingSafeEqual(a, b) {
    if (a.byteLength !== b.byteLength) {
        return false;
    }
    if (!(a instanceof DataView)) {
        a = new DataView(ArrayBuffer.isView(a) ? a.buffer : a);
    }
    if (!(b instanceof DataView)) {
        b = new DataView(ArrayBuffer.isView(b) ? b.buffer : b);
    }
    assert(a instanceof DataView);
    assert(b instanceof DataView);
    const length = a.byteLength;
    let out = 0;
    let i = -1;
    while(++i < length){
        out |= a.getUint8(i) ^ b.getUint8(i);
    }
    return out === 0;
}
exports.timingSafeEqual = timingSafeEqual;
}),
"[project]/node_modules/standardwebhooks/dist/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Webhook = exports.WebhookVerificationError = void 0;
const timing_safe_equal_1 = __turbopack_context__.r("[project]/node_modules/standardwebhooks/dist/timing_safe_equal.js [app-route] (ecmascript)");
const base64 = __turbopack_context__.r("[project]/node_modules/@stablelib/base64/lib/base64.js [app-route] (ecmascript)");
const sha256 = __turbopack_context__.r("[project]/node_modules/fast-sha256/sha256.js [app-route] (ecmascript)");
const WEBHOOK_TOLERANCE_IN_SECONDS = 5 * 60;
class ExtendableError extends Error {
    constructor(message){
        super(message);
        Object.setPrototypeOf(this, ExtendableError.prototype);
        this.name = "ExtendableError";
        this.stack = new Error(message).stack;
    }
}
class WebhookVerificationError extends ExtendableError {
    constructor(message){
        super(message);
        Object.setPrototypeOf(this, WebhookVerificationError.prototype);
        this.name = "WebhookVerificationError";
    }
}
exports.WebhookVerificationError = WebhookVerificationError;
class Webhook {
    constructor(secret, options){
        if (!secret) {
            throw new Error("Secret can't be empty.");
        }
        if ((options === null || options === void 0 ? void 0 : options.format) === "raw") {
            if (secret instanceof Uint8Array) {
                this.key = secret;
            } else {
                this.key = Uint8Array.from(secret, (c)=>c.charCodeAt(0));
            }
        } else {
            if (typeof secret !== "string") {
                throw new Error("Expected secret to be of type string");
            }
            if (secret.startsWith(Webhook.prefix)) {
                secret = secret.substring(Webhook.prefix.length);
            }
            this.key = base64.decode(secret);
        }
    }
    verify(payload, headers_) {
        const headers = {};
        for (const key of Object.keys(headers_)){
            headers[key.toLowerCase()] = headers_[key];
        }
        const msgId = headers["webhook-id"];
        const msgSignature = headers["webhook-signature"];
        const msgTimestamp = headers["webhook-timestamp"];
        if (!msgSignature || !msgId || !msgTimestamp) {
            throw new WebhookVerificationError("Missing required headers");
        }
        const timestamp = this.verifyTimestamp(msgTimestamp);
        const computedSignature = this.sign(msgId, timestamp, payload);
        const expectedSignature = computedSignature.split(",")[1];
        const passedSignatures = msgSignature.split(" ");
        const encoder = new globalThis.TextEncoder();
        for (const versionedSignature of passedSignatures){
            const [version, signature] = versionedSignature.split(",");
            if (version !== "v1") {
                continue;
            }
            if ((0, timing_safe_equal_1.timingSafeEqual)(encoder.encode(signature), encoder.encode(expectedSignature))) {
                return JSON.parse(payload.toString());
            }
        }
        throw new WebhookVerificationError("No matching signature found");
    }
    sign(msgId, timestamp, payload) {
        if (typeof payload === "string") {} else if (payload.constructor.name === "Buffer") {
            payload = payload.toString();
        } else {
            throw new Error("Expected payload to be of type string or Buffer.");
        }
        const encoder = new TextEncoder();
        const timestampNumber = Math.floor(timestamp.getTime() / 1000);
        const toSign = encoder.encode(`${msgId}.${timestampNumber}.${payload}`);
        const expectedSignature = base64.encode(sha256.hmac(this.key, toSign));
        return `v1,${expectedSignature}`;
    }
    verifyTimestamp(timestampHeader) {
        const now = Math.floor(Date.now() / 1000);
        const timestamp = parseInt(timestampHeader, 10);
        if (isNaN(timestamp)) {
            throw new WebhookVerificationError("Invalid Signature Headers");
        }
        if (now - timestamp > WEBHOOK_TOLERANCE_IN_SECONDS) {
            throw new WebhookVerificationError("Message timestamp too old");
        }
        if (timestamp > now + WEBHOOK_TOLERANCE_IN_SECONDS) {
            throw new WebhookVerificationError("Message timestamp too new");
        }
        return new Date(timestamp * 1000);
    }
}
exports.Webhook = Webhook;
Webhook.prefix = "whsec_";
}),
"[project]/node_modules/@stablelib/base64/lib/base64.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

// Copyright (C) 2016 Dmitry Chestnykh
// MIT License. See LICENSE file for details.
var __extends = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (b.hasOwnProperty(p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
Object.defineProperty(exports, "__esModule", {
    value: true
});
/**
 * Package base64 implements Base64 encoding and decoding.
 */ // Invalid character used in decoding to indicate
// that the character to decode is out of range of
// alphabet and cannot be decoded.
var INVALID_BYTE = 256;
/**
 * Implements standard Base64 encoding.
 *
 * Operates in constant time.
 */ var Coder = function() {
    // TODO(dchest): methods to encode chunk-by-chunk.
    function Coder(_paddingCharacter) {
        if (_paddingCharacter === void 0) {
            _paddingCharacter = "=";
        }
        this._paddingCharacter = _paddingCharacter;
    }
    Coder.prototype.encodedLength = function(length) {
        if (!this._paddingCharacter) {
            return (length * 8 + 5) / 6 | 0;
        }
        return (length + 2) / 3 * 4 | 0;
    };
    Coder.prototype.encode = function(data) {
        var out = "";
        var i = 0;
        for(; i < data.length - 2; i += 3){
            var c = data[i] << 16 | data[i + 1] << 8 | data[i + 2];
            out += this._encodeByte(c >>> 3 * 6 & 63);
            out += this._encodeByte(c >>> 2 * 6 & 63);
            out += this._encodeByte(c >>> 1 * 6 & 63);
            out += this._encodeByte(c >>> 0 * 6 & 63);
        }
        var left = data.length - i;
        if (left > 0) {
            var c = data[i] << 16 | (left === 2 ? data[i + 1] << 8 : 0);
            out += this._encodeByte(c >>> 3 * 6 & 63);
            out += this._encodeByte(c >>> 2 * 6 & 63);
            if (left === 2) {
                out += this._encodeByte(c >>> 1 * 6 & 63);
            } else {
                out += this._paddingCharacter || "";
            }
            out += this._paddingCharacter || "";
        }
        return out;
    };
    Coder.prototype.maxDecodedLength = function(length) {
        if (!this._paddingCharacter) {
            return (length * 6 + 7) / 8 | 0;
        }
        return length / 4 * 3 | 0;
    };
    Coder.prototype.decodedLength = function(s) {
        return this.maxDecodedLength(s.length - this._getPaddingLength(s));
    };
    Coder.prototype.decode = function(s) {
        if (s.length === 0) {
            return new Uint8Array(0);
        }
        var paddingLength = this._getPaddingLength(s);
        var length = s.length - paddingLength;
        var out = new Uint8Array(this.maxDecodedLength(length));
        var op = 0;
        var i = 0;
        var haveBad = 0;
        var v0 = 0, v1 = 0, v2 = 0, v3 = 0;
        for(; i < length - 4; i += 4){
            v0 = this._decodeChar(s.charCodeAt(i + 0));
            v1 = this._decodeChar(s.charCodeAt(i + 1));
            v2 = this._decodeChar(s.charCodeAt(i + 2));
            v3 = this._decodeChar(s.charCodeAt(i + 3));
            out[op++] = v0 << 2 | v1 >>> 4;
            out[op++] = v1 << 4 | v2 >>> 2;
            out[op++] = v2 << 6 | v3;
            haveBad |= v0 & INVALID_BYTE;
            haveBad |= v1 & INVALID_BYTE;
            haveBad |= v2 & INVALID_BYTE;
            haveBad |= v3 & INVALID_BYTE;
        }
        if (i < length - 1) {
            v0 = this._decodeChar(s.charCodeAt(i));
            v1 = this._decodeChar(s.charCodeAt(i + 1));
            out[op++] = v0 << 2 | v1 >>> 4;
            haveBad |= v0 & INVALID_BYTE;
            haveBad |= v1 & INVALID_BYTE;
        }
        if (i < length - 2) {
            v2 = this._decodeChar(s.charCodeAt(i + 2));
            out[op++] = v1 << 4 | v2 >>> 2;
            haveBad |= v2 & INVALID_BYTE;
        }
        if (i < length - 3) {
            v3 = this._decodeChar(s.charCodeAt(i + 3));
            out[op++] = v2 << 6 | v3;
            haveBad |= v3 & INVALID_BYTE;
        }
        if (haveBad !== 0) {
            throw new Error("Base64Coder: incorrect characters for decoding");
        }
        return out;
    };
    // Standard encoding have the following encoded/decoded ranges,
    // which we need to convert between.
    //
    // ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789  +   /
    // Index:   0 - 25                    26 - 51              52 - 61   62  63
    // ASCII:  65 - 90                    97 - 122             48 - 57   43  47
    //
    // Encode 6 bits in b into a new character.
    Coder.prototype._encodeByte = function(b) {
        // Encoding uses constant time operations as follows:
        //
        // 1. Define comparison of A with B using (A - B) >>> 8:
        //          if A > B, then result is positive integer
        //          if A <= B, then result is 0
        //
        // 2. Define selection of C or 0 using bitwise AND: X & C:
        //          if X == 0, then result is 0
        //          if X != 0, then result is C
        //
        // 3. Start with the smallest comparison (b >= 0), which is always
        //    true, so set the result to the starting ASCII value (65).
        //
        // 4. Continue comparing b to higher ASCII values, and selecting
        //    zero if comparison isn't true, otherwise selecting a value
        //    to add to result, which:
        //
        //          a) undoes the previous addition
        //          b) provides new value to add
        //
        var result = b;
        // b >= 0
        result += 65;
        // b > 25
        result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
        // b > 51
        result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
        // b > 61
        result += 61 - b >>> 8 & 52 - 48 - 62 + 43;
        // b > 62
        result += 62 - b >>> 8 & 62 - 43 - 63 + 47;
        return String.fromCharCode(result);
    };
    // Decode a character code into a byte.
    // Must return 256 if character is out of alphabet range.
    Coder.prototype._decodeChar = function(c) {
        // Decoding works similar to encoding: using the same comparison
        // function, but now it works on ranges: result is always incremented
        // by value, but this value becomes zero if the range is not
        // satisfied.
        //
        // Decoding starts with invalid value, 256, which is then
        // subtracted when the range is satisfied. If none of the ranges
        // apply, the function returns 256, which is then checked by
        // the caller to throw error.
        var result = INVALID_BYTE; // start with invalid character
        // c == 43 (c > 42 and c < 44)
        result += (42 - c & c - 44) >>> 8 & -INVALID_BYTE + c - 43 + 62;
        // c == 47 (c > 46 and c < 48)
        result += (46 - c & c - 48) >>> 8 & -INVALID_BYTE + c - 47 + 63;
        // c > 47 and c < 58
        result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
        // c > 64 and c < 91
        result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
        // c > 96 and c < 123
        result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
        return result;
    };
    Coder.prototype._getPaddingLength = function(s) {
        var paddingLength = 0;
        if (this._paddingCharacter) {
            for(var i = s.length - 1; i >= 0; i--){
                if (s[i] !== this._paddingCharacter) {
                    break;
                }
                paddingLength++;
            }
            if (s.length < 4 || paddingLength > 2) {
                throw new Error("Base64Coder: incorrect padding");
            }
        }
        return paddingLength;
    };
    return Coder;
}();
exports.Coder = Coder;
var stdCoder = new Coder();
function encode(data) {
    return stdCoder.encode(data);
}
exports.encode = encode;
function decode(s) {
    return stdCoder.decode(s);
}
exports.decode = decode;
/**
 * Implements URL-safe Base64 encoding.
 * (Same as Base64, but '+' is replaced with '-', and '/' with '_').
 *
 * Operates in constant time.
 */ var URLSafeCoder = function(_super) {
    __extends(URLSafeCoder, _super);
    function URLSafeCoder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // URL-safe encoding have the following encoded/decoded ranges:
    //
    // ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789  -   _
    // Index:   0 - 25                    26 - 51              52 - 61   62  63
    // ASCII:  65 - 90                    97 - 122             48 - 57   45  95
    //
    URLSafeCoder.prototype._encodeByte = function(b) {
        var result = b;
        // b >= 0
        result += 65;
        // b > 25
        result += 25 - b >>> 8 & 0 - 65 - 26 + 97;
        // b > 51
        result += 51 - b >>> 8 & 26 - 97 - 52 + 48;
        // b > 61
        result += 61 - b >>> 8 & 52 - 48 - 62 + 45;
        // b > 62
        result += 62 - b >>> 8 & 62 - 45 - 63 + 95;
        return String.fromCharCode(result);
    };
    URLSafeCoder.prototype._decodeChar = function(c) {
        var result = INVALID_BYTE;
        // c == 45 (c > 44 and c < 46)
        result += (44 - c & c - 46) >>> 8 & -INVALID_BYTE + c - 45 + 62;
        // c == 95 (c > 94 and c < 96)
        result += (94 - c & c - 96) >>> 8 & -INVALID_BYTE + c - 95 + 63;
        // c > 47 and c < 58
        result += (47 - c & c - 58) >>> 8 & -INVALID_BYTE + c - 48 + 52;
        // c > 64 and c < 91
        result += (64 - c & c - 91) >>> 8 & -INVALID_BYTE + c - 65 + 0;
        // c > 96 and c < 123
        result += (96 - c & c - 123) >>> 8 & -INVALID_BYTE + c - 97 + 26;
        return result;
    };
    return URLSafeCoder;
}(Coder);
exports.URLSafeCoder = URLSafeCoder;
var urlSafeCoder = new URLSafeCoder();
function encodeURLSafe(data) {
    return urlSafeCoder.encode(data);
}
exports.encodeURLSafe = encodeURLSafe;
function decodeURLSafe(s) {
    return urlSafeCoder.decode(s);
}
exports.decodeURLSafe = decodeURLSafe;
exports.encodedLength = function(length) {
    return stdCoder.encodedLength(length);
};
exports.maxDecodedLength = function(length) {
    return stdCoder.maxDecodedLength(length);
};
exports.decodedLength = function(s) {
    return stdCoder.decodedLength(s);
};
}),
"[project]/node_modules/fast-sha256/sha256.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

(function(root, factory) {
    // Hack to make all exports of this module sha256 function object properties.
    var exports = {};
    factory(exports);
    var sha256 = exports["default"];
    for(var k in exports){
        sha256[k] = exports[k];
    }
    if (("TURBOPACK compile-time value", "object") === 'object' && typeof module.exports === 'object') {
        module.exports = sha256;
    } else if (typeof define === 'function' && define.amd) {
        ((r)=>r !== undefined && __turbopack_context__.v(r))(function() {
            return sha256;
        }(__turbopack_context__.r, exports, module));
    } else {
        root.sha256 = sha256;
    }
})(/*TURBOPACK member replacement*/ __turbopack_context__.e, function(exports) {
    "use strict";
    exports.__esModule = true;
    // SHA-256 (+ HMAC and PBKDF2) for JavaScript.
    //
    // Written in 2014-2016 by Dmitry Chestnykh.
    // Public domain, no warranty.
    //
    // Functions (accept and return Uint8Arrays):
    //
    //   sha256(message) -> hash
    //   sha256.hmac(key, message) -> mac
    //   sha256.pbkdf2(password, salt, rounds, dkLen) -> dk
    //
    //  Classes:
    //
    //   new sha256.Hash()
    //   new sha256.HMAC(key)
    //
    exports.digestLength = 32;
    exports.blockSize = 64;
    // SHA-256 constants
    var K = new Uint32Array([
        0x428a2f98,
        0x71374491,
        0xb5c0fbcf,
        0xe9b5dba5,
        0x3956c25b,
        0x59f111f1,
        0x923f82a4,
        0xab1c5ed5,
        0xd807aa98,
        0x12835b01,
        0x243185be,
        0x550c7dc3,
        0x72be5d74,
        0x80deb1fe,
        0x9bdc06a7,
        0xc19bf174,
        0xe49b69c1,
        0xefbe4786,
        0x0fc19dc6,
        0x240ca1cc,
        0x2de92c6f,
        0x4a7484aa,
        0x5cb0a9dc,
        0x76f988da,
        0x983e5152,
        0xa831c66d,
        0xb00327c8,
        0xbf597fc7,
        0xc6e00bf3,
        0xd5a79147,
        0x06ca6351,
        0x14292967,
        0x27b70a85,
        0x2e1b2138,
        0x4d2c6dfc,
        0x53380d13,
        0x650a7354,
        0x766a0abb,
        0x81c2c92e,
        0x92722c85,
        0xa2bfe8a1,
        0xa81a664b,
        0xc24b8b70,
        0xc76c51a3,
        0xd192e819,
        0xd6990624,
        0xf40e3585,
        0x106aa070,
        0x19a4c116,
        0x1e376c08,
        0x2748774c,
        0x34b0bcb5,
        0x391c0cb3,
        0x4ed8aa4a,
        0x5b9cca4f,
        0x682e6ff3,
        0x748f82ee,
        0x78a5636f,
        0x84c87814,
        0x8cc70208,
        0x90befffa,
        0xa4506ceb,
        0xbef9a3f7,
        0xc67178f2
    ]);
    function hashBlocks(w, v, p, pos, len) {
        var a, b, c, d, e, f, g, h, u, i, j, t1, t2;
        while(len >= 64){
            a = v[0];
            b = v[1];
            c = v[2];
            d = v[3];
            e = v[4];
            f = v[5];
            g = v[6];
            h = v[7];
            for(i = 0; i < 16; i++){
                j = pos + i * 4;
                w[i] = (p[j] & 0xff) << 24 | (p[j + 1] & 0xff) << 16 | (p[j + 2] & 0xff) << 8 | p[j + 3] & 0xff;
            }
            for(i = 16; i < 64; i++){
                u = w[i - 2];
                t1 = (u >>> 17 | u << 32 - 17) ^ (u >>> 19 | u << 32 - 19) ^ u >>> 10;
                u = w[i - 15];
                t2 = (u >>> 7 | u << 32 - 7) ^ (u >>> 18 | u << 32 - 18) ^ u >>> 3;
                w[i] = (t1 + w[i - 7] | 0) + (t2 + w[i - 16] | 0);
            }
            for(i = 0; i < 64; i++){
                t1 = (((e >>> 6 | e << 32 - 6) ^ (e >>> 11 | e << 32 - 11) ^ (e >>> 25 | e << 32 - 25)) + (e & f ^ ~e & g) | 0) + (h + (K[i] + w[i] | 0) | 0) | 0;
                t2 = ((a >>> 2 | a << 32 - 2) ^ (a >>> 13 | a << 32 - 13) ^ (a >>> 22 | a << 32 - 22)) + (a & b ^ a & c ^ b & c) | 0;
                h = g;
                g = f;
                f = e;
                e = d + t1 | 0;
                d = c;
                c = b;
                b = a;
                a = t1 + t2 | 0;
            }
            v[0] += a;
            v[1] += b;
            v[2] += c;
            v[3] += d;
            v[4] += e;
            v[5] += f;
            v[6] += g;
            v[7] += h;
            pos += 64;
            len -= 64;
        }
        return pos;
    }
    // Hash implements SHA256 hash algorithm.
    var Hash = function() {
        function Hash() {
            this.digestLength = exports.digestLength;
            this.blockSize = exports.blockSize;
            // Note: Int32Array is used instead of Uint32Array for performance reasons.
            this.state = new Int32Array(8); // hash state
            this.temp = new Int32Array(64); // temporary state
            this.buffer = new Uint8Array(128); // buffer for data to hash
            this.bufferLength = 0; // number of bytes in buffer
            this.bytesHashed = 0; // number of total bytes hashed
            this.finished = false; // indicates whether the hash was finalized
            this.reset();
        }
        // Resets hash state making it possible
        // to re-use this instance to hash other data.
        Hash.prototype.reset = function() {
            this.state[0] = 0x6a09e667;
            this.state[1] = 0xbb67ae85;
            this.state[2] = 0x3c6ef372;
            this.state[3] = 0xa54ff53a;
            this.state[4] = 0x510e527f;
            this.state[5] = 0x9b05688c;
            this.state[6] = 0x1f83d9ab;
            this.state[7] = 0x5be0cd19;
            this.bufferLength = 0;
            this.bytesHashed = 0;
            this.finished = false;
            return this;
        };
        // Cleans internal buffers and re-initializes hash state.
        Hash.prototype.clean = function() {
            for(var i = 0; i < this.buffer.length; i++){
                this.buffer[i] = 0;
            }
            for(var i = 0; i < this.temp.length; i++){
                this.temp[i] = 0;
            }
            this.reset();
        };
        // Updates hash state with the given data.
        //
        // Optionally, length of the data can be specified to hash
        // fewer bytes than data.length.
        //
        // Throws error when trying to update already finalized hash:
        // instance must be reset to use it again.
        Hash.prototype.update = function(data, dataLength) {
            if (dataLength === void 0) {
                dataLength = data.length;
            }
            if (this.finished) {
                throw new Error("SHA256: can't update because hash was finished.");
            }
            var dataPos = 0;
            this.bytesHashed += dataLength;
            if (this.bufferLength > 0) {
                while(this.bufferLength < 64 && dataLength > 0){
                    this.buffer[this.bufferLength++] = data[dataPos++];
                    dataLength--;
                }
                if (this.bufferLength === 64) {
                    hashBlocks(this.temp, this.state, this.buffer, 0, 64);
                    this.bufferLength = 0;
                }
            }
            if (dataLength >= 64) {
                dataPos = hashBlocks(this.temp, this.state, data, dataPos, dataLength);
                dataLength %= 64;
            }
            while(dataLength > 0){
                this.buffer[this.bufferLength++] = data[dataPos++];
                dataLength--;
            }
            return this;
        };
        // Finalizes hash state and puts hash into out.
        //
        // If hash was already finalized, puts the same value.
        Hash.prototype.finish = function(out) {
            if (!this.finished) {
                var bytesHashed = this.bytesHashed;
                var left = this.bufferLength;
                var bitLenHi = bytesHashed / 0x20000000 | 0;
                var bitLenLo = bytesHashed << 3;
                var padLength = bytesHashed % 64 < 56 ? 64 : 128;
                this.buffer[left] = 0x80;
                for(var i = left + 1; i < padLength - 8; i++){
                    this.buffer[i] = 0;
                }
                this.buffer[padLength - 8] = bitLenHi >>> 24 & 0xff;
                this.buffer[padLength - 7] = bitLenHi >>> 16 & 0xff;
                this.buffer[padLength - 6] = bitLenHi >>> 8 & 0xff;
                this.buffer[padLength - 5] = bitLenHi >>> 0 & 0xff;
                this.buffer[padLength - 4] = bitLenLo >>> 24 & 0xff;
                this.buffer[padLength - 3] = bitLenLo >>> 16 & 0xff;
                this.buffer[padLength - 2] = bitLenLo >>> 8 & 0xff;
                this.buffer[padLength - 1] = bitLenLo >>> 0 & 0xff;
                hashBlocks(this.temp, this.state, this.buffer, 0, padLength);
                this.finished = true;
            }
            for(var i = 0; i < 8; i++){
                out[i * 4 + 0] = this.state[i] >>> 24 & 0xff;
                out[i * 4 + 1] = this.state[i] >>> 16 & 0xff;
                out[i * 4 + 2] = this.state[i] >>> 8 & 0xff;
                out[i * 4 + 3] = this.state[i] >>> 0 & 0xff;
            }
            return this;
        };
        // Returns the final hash digest.
        Hash.prototype.digest = function() {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
        };
        // Internal function for use in HMAC for optimization.
        Hash.prototype._saveState = function(out) {
            for(var i = 0; i < this.state.length; i++){
                out[i] = this.state[i];
            }
        };
        // Internal function for use in HMAC for optimization.
        Hash.prototype._restoreState = function(from, bytesHashed) {
            for(var i = 0; i < this.state.length; i++){
                this.state[i] = from[i];
            }
            this.bytesHashed = bytesHashed;
            this.finished = false;
            this.bufferLength = 0;
        };
        return Hash;
    }();
    exports.Hash = Hash;
    // HMAC implements HMAC-SHA256 message authentication algorithm.
    var HMAC = function() {
        function HMAC(key) {
            this.inner = new Hash();
            this.outer = new Hash();
            this.blockSize = this.inner.blockSize;
            this.digestLength = this.inner.digestLength;
            var pad = new Uint8Array(this.blockSize);
            if (key.length > this.blockSize) {
                new Hash().update(key).finish(pad).clean();
            } else {
                for(var i = 0; i < key.length; i++){
                    pad[i] = key[i];
                }
            }
            for(var i = 0; i < pad.length; i++){
                pad[i] ^= 0x36;
            }
            this.inner.update(pad);
            for(var i = 0; i < pad.length; i++){
                pad[i] ^= 0x36 ^ 0x5c;
            }
            this.outer.update(pad);
            this.istate = new Uint32Array(8);
            this.ostate = new Uint32Array(8);
            this.inner._saveState(this.istate);
            this.outer._saveState(this.ostate);
            for(var i = 0; i < pad.length; i++){
                pad[i] = 0;
            }
        }
        // Returns HMAC state to the state initialized with key
        // to make it possible to run HMAC over the other data with the same
        // key without creating a new instance.
        HMAC.prototype.reset = function() {
            this.inner._restoreState(this.istate, this.inner.blockSize);
            this.outer._restoreState(this.ostate, this.outer.blockSize);
            return this;
        };
        // Cleans HMAC state.
        HMAC.prototype.clean = function() {
            for(var i = 0; i < this.istate.length; i++){
                this.ostate[i] = this.istate[i] = 0;
            }
            this.inner.clean();
            this.outer.clean();
        };
        // Updates state with provided data.
        HMAC.prototype.update = function(data) {
            this.inner.update(data);
            return this;
        };
        // Finalizes HMAC and puts the result in out.
        HMAC.prototype.finish = function(out) {
            if (this.outer.finished) {
                this.outer.finish(out);
            } else {
                this.inner.finish(out);
                this.outer.update(out, this.digestLength).finish(out);
            }
            return this;
        };
        // Returns message authentication code.
        HMAC.prototype.digest = function() {
            var out = new Uint8Array(this.digestLength);
            this.finish(out);
            return out;
        };
        return HMAC;
    }();
    exports.HMAC = HMAC;
    // Returns SHA256 hash of data.
    function hash(data) {
        var h = new Hash().update(data);
        var digest = h.digest();
        h.clean();
        return digest;
    }
    exports.hash = hash;
    // Function hash is both available as module.hash and as default export.
    exports["default"] = hash;
    // Returns HMAC-SHA256 of data under the key.
    function hmac(key, data) {
        var h = new HMAC(key).update(data);
        var digest = h.digest();
        h.clean();
        return digest;
    }
    exports.hmac = hmac;
    // Fills hkdf buffer like this:
    // T(1) = HMAC-Hash(PRK, T(0) | info | 0x01)
    function fillBuffer(buffer, hmac, info, counter) {
        // Counter is a byte value: check if it overflowed.
        var num = counter[0];
        if (num === 0) {
            throw new Error("hkdf: cannot expand more");
        }
        // Prepare HMAC instance for new data with old key.
        hmac.reset();
        // Hash in previous output if it was generated
        // (i.e. counter is greater than 1).
        if (num > 1) {
            hmac.update(buffer);
        }
        // Hash in info if it exists.
        if (info) {
            hmac.update(info);
        }
        // Hash in the counter.
        hmac.update(counter);
        // Output result to buffer and clean HMAC instance.
        hmac.finish(buffer);
        // Increment counter inside typed array, this works properly.
        counter[0]++;
    }
    var hkdfSalt = new Uint8Array(exports.digestLength); // Filled with zeroes.
    function hkdf(key, salt, info, length) {
        if (salt === void 0) {
            salt = hkdfSalt;
        }
        if (length === void 0) {
            length = 32;
        }
        var counter = new Uint8Array([
            1
        ]);
        // HKDF-Extract uses salt as HMAC key, and key as data.
        var okm = hmac(salt, key);
        // Initialize HMAC for expanding with extracted key.
        // Ensure no collisions with `hmac` function.
        var hmac_ = new HMAC(okm);
        // Allocate buffer.
        var buffer = new Uint8Array(hmac_.digestLength);
        var bufpos = buffer.length;
        var out = new Uint8Array(length);
        for(var i = 0; i < length; i++){
            if (bufpos === buffer.length) {
                fillBuffer(buffer, hmac_, info, counter);
                bufpos = 0;
            }
            out[i] = buffer[bufpos++];
        }
        hmac_.clean();
        buffer.fill(0);
        counter.fill(0);
        return out;
    }
    exports.hkdf = hkdf;
    // Derives a key from password and salt using PBKDF2-HMAC-SHA256
    // with the given number of iterations.
    //
    // The number of bytes returned is equal to dkLen.
    //
    // (For better security, avoid dkLen greater than hash length - 32 bytes).
    function pbkdf2(password, salt, iterations, dkLen) {
        var prf = new HMAC(password);
        var len = prf.digestLength;
        var ctr = new Uint8Array(4);
        var t = new Uint8Array(len);
        var u = new Uint8Array(len);
        var dk = new Uint8Array(dkLen);
        for(var i = 0; i * len < dkLen; i++){
            var c = i + 1;
            ctr[0] = c >>> 24 & 0xff;
            ctr[1] = c >>> 16 & 0xff;
            ctr[2] = c >>> 8 & 0xff;
            ctr[3] = c >>> 0 & 0xff;
            prf.reset();
            prf.update(salt);
            prf.update(ctr);
            prf.finish(u);
            for(var j = 0; j < len; j++){
                t[j] = u[j];
            }
            for(var j = 2; j <= iterations; j++){
                prf.reset();
                prf.update(u).finish(u);
                for(var k = 0; k < len; k++){
                    t[k] ^= u[k];
                }
            }
            for(var j = 0; j < len && i * len + j < dkLen; j++){
                dk[i * len + j] = t[j];
            }
        }
        for(var i = 0; i < len; i++){
            t[i] = u[i] = 0;
        }
        for(var i = 0; i < 4; i++){
            ctr[i] = 0;
        }
        prf.clean();
        return dk;
    }
    exports.pbkdf2 = pbkdf2;
});
}),
"[project]/node_modules/resend/dist/index.mjs [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Resend",
    ()=>Resend
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$postal$2d$mime$2f$src$2f$postal$2d$mime$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/postal-mime/src/postal-mime.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$svix$2f$dist$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/svix/dist/index.js [app-route] (ecmascript)");
;
;
//#region package.json
var version = "6.12.2";
//#endregion
//#region src/common/utils/build-pagination-query.ts
/**
* Builds a query string from pagination options
* @param options - Pagination options containing limit and either after or before (but not both)
* @returns Query string (without leading '?') or empty string if no options
*/ function buildPaginationQuery(options) {
    const searchParams = new URLSearchParams();
    if (options.limit !== void 0) searchParams.set("limit", options.limit.toString());
    if ("after" in options && options.after !== void 0) searchParams.set("after", options.after);
    if ("before" in options && options.before !== void 0) searchParams.set("before", options.before);
    return searchParams.toString();
}
//#endregion
//#region src/api-keys/api-keys.ts
var ApiKeys = class {
    constructor(resend){
        this.resend = resend;
    }
    async create(payload, options = {}) {
        return await this.resend.post("/api-keys", payload, options);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/api-keys?${queryString}` : "/api-keys";
        return await this.resend.get(url);
    }
    async remove(id) {
        return await this.resend.delete(`/api-keys/${id}`);
    }
};
//#endregion
//#region src/automation-runs/automation-runs.ts
var AutomationRuns = class {
    constructor(resend){
        this.resend = resend;
    }
    async get(options) {
        return await this.resend.get(`/automations/${options.automationId}/runs/${options.runId}`);
    }
    async list(options) {
        const queryString = buildPaginationQuery(options);
        const searchParams = new URLSearchParams(queryString);
        if (options.status) {
            const statusValue = Array.isArray(options.status) ? options.status.join(",") : options.status;
            searchParams.set("status", statusValue);
        }
        const qs = searchParams.toString();
        const url = qs ? `/automations/${options.automationId}/runs?${qs}` : `/automations/${options.automationId}/runs`;
        return await this.resend.get(url);
    }
};
//#endregion
//#region src/common/utils/parse-automation-to-api-options.ts
function parseStepConfig(step) {
    switch(step.type){
        case "trigger":
            return {
                key: step.key,
                type: step.type,
                config: {
                    event_name: step.config.eventName
                }
            };
        case "delay":
            return {
                key: step.key,
                type: step.type,
                config: step.config
            };
        case "send_email":
            return {
                key: step.key,
                type: step.type,
                config: {
                    template: step.config.template,
                    subject: step.config.subject,
                    from: step.config.from,
                    reply_to: step.config.replyTo
                }
            };
        case "wait_for_event":
            return {
                key: step.key,
                type: step.type,
                config: {
                    event_name: step.config.eventName,
                    timeout: step.config.timeout,
                    filter_rule: step.config.filterRule
                }
            };
        case "condition":
            return {
                key: step.key,
                type: step.type,
                config: step.config
            };
        case "contact_update":
            return {
                key: step.key,
                type: step.type,
                config: {
                    first_name: step.config.firstName,
                    last_name: step.config.lastName,
                    unsubscribed: step.config.unsubscribed,
                    properties: step.config.properties
                }
            };
        case "contact_delete":
            return {
                key: step.key,
                type: step.type,
                config: step.config
            };
        case "add_to_segment":
            return {
                key: step.key,
                type: step.type,
                config: {
                    segment_id: step.config.segmentId
                }
            };
    }
}
function parseConnection(connection) {
    return {
        from: connection.from,
        to: connection.to,
        type: connection.type
    };
}
function parseAutomationToApiOptions(automation) {
    return {
        name: automation.name,
        status: automation.status,
        steps: automation.steps.map(parseStepConfig),
        connections: automation.connections.map(parseConnection)
    };
}
function parseEventToApiOptions(event) {
    return {
        event: event.event,
        contact_id: event.contactId,
        email: event.email,
        payload: event.payload
    };
}
//#endregion
//#region src/automations/automations.ts
var Automations = class {
    constructor(resend){
        this.resend = resend;
        this.runs = new AutomationRuns(this.resend);
    }
    async create(payload) {
        return await this.resend.post("/automations", parseAutomationToApiOptions(payload));
    }
    async list(options = {}) {
        const params = [
            buildPaginationQuery(options)
        ];
        if (options.status) params.push(`status=${encodeURIComponent(options.status)}`);
        const qs = params.filter(Boolean).join("&");
        const url = qs ? `/automations?${qs}` : "/automations";
        return await this.resend.get(url);
    }
    async get(id) {
        return await this.resend.get(`/automations/${id}`);
    }
    async remove(id) {
        return await this.resend.delete(`/automations/${id}`);
    }
    async update(id, payload) {
        const apiPayload = {};
        if (payload.name !== void 0) apiPayload.name = payload.name;
        if (payload.status !== void 0) apiPayload.status = payload.status;
        if (payload.steps !== void 0) apiPayload.steps = payload.steps.map(parseStepConfig);
        if (payload.connections !== void 0) apiPayload.connections = payload.connections.map(parseConnection);
        return await this.resend.patch(`/automations/${id}`, apiPayload);
    }
    async stop(id) {
        return await this.resend.post(`/automations/${id}/stop`);
    }
};
//#endregion
//#region src/common/utils/parse-email-to-api-options.ts
function parseAttachments(attachments) {
    return attachments?.map((attachment)=>({
            content: attachment.content,
            filename: attachment.filename,
            path: attachment.path,
            content_type: attachment.contentType,
            content_id: attachment.contentId
        }));
}
function parseEmailToApiOptions(email) {
    return {
        attachments: parseAttachments(email.attachments),
        bcc: email.bcc,
        cc: email.cc,
        from: email.from,
        headers: email.headers,
        html: email.html,
        reply_to: email.replyTo,
        scheduled_at: email.scheduledAt,
        subject: email.subject,
        tags: email.tags,
        text: email.text,
        to: email.to,
        template: email.template ? {
            id: email.template.id,
            variables: email.template.variables
        } : void 0,
        topic_id: email.topicId
    };
}
//#endregion
//#region src/render.ts
async function render(node) {
    let render;
    try {
        ({ render } = await Promise.resolve().then(()=>{
            const e = new Error("Cannot find module '@react-email/render'");
            e.code = 'MODULE_NOT_FOUND';
            throw e;
        }));
    } catch  {
        throw new Error("Failed to render React component. Make sure to install `@react-email/render` or `@react-email/components`.");
    }
    return render(node);
}
//#endregion
//#region src/batch/batch.ts
var Batch = class {
    constructor(resend){
        this.resend = resend;
    }
    async send(payload, options) {
        return this.create(payload, options);
    }
    async create(payload, options) {
        const emails = [];
        for (const email of payload){
            if (email.react) {
                email.html = await render(email.react);
                email.react = void 0;
            }
            emails.push(parseEmailToApiOptions(email));
        }
        return await this.resend.post("/emails/batch", emails, {
            ...options,
            headers: {
                "x-batch-validation": options?.batchValidation ?? "strict",
                ...options?.headers
            }
        });
    }
};
//#endregion
//#region src/broadcasts/broadcasts.ts
var Broadcasts = class {
    constructor(resend){
        this.resend = resend;
    }
    async create(payload, options = {}) {
        if (payload.react) payload.html = await render(payload.react);
        return await this.resend.post("/broadcasts", {
            name: payload.name,
            segment_id: payload.segmentId,
            audience_id: payload.audienceId,
            preview_text: payload.previewText,
            from: payload.from,
            html: payload.html,
            reply_to: payload.replyTo,
            subject: payload.subject,
            text: payload.text,
            topic_id: payload.topicId,
            send: payload.send,
            scheduled_at: payload.scheduledAt
        }, options);
    }
    async send(id, payload) {
        return await this.resend.post(`/broadcasts/${id}/send`, {
            scheduled_at: payload?.scheduledAt
        });
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/broadcasts?${queryString}` : "/broadcasts";
        return await this.resend.get(url);
    }
    async get(id) {
        return await this.resend.get(`/broadcasts/${id}`);
    }
    async remove(id) {
        return await this.resend.delete(`/broadcasts/${id}`);
    }
    async update(id, payload) {
        if (payload.react) payload.html = await render(payload.react);
        return await this.resend.patch(`/broadcasts/${id}`, {
            name: payload.name,
            segment_id: payload.segmentId,
            audience_id: payload.audienceId,
            from: payload.from,
            html: payload.html,
            text: payload.text,
            subject: payload.subject,
            reply_to: payload.replyTo,
            preview_text: payload.previewText,
            topic_id: payload.topicId
        });
    }
};
//#endregion
//#region src/common/utils/parse-contact-properties-to-api-options.ts
function parseContactPropertyFromApi(contactProperty) {
    return {
        id: contactProperty.id,
        key: contactProperty.key,
        createdAt: contactProperty.created_at,
        type: contactProperty.type,
        fallbackValue: contactProperty.fallback_value
    };
}
function parseContactPropertyToApiOptions(contactProperty) {
    if ("key" in contactProperty) return {
        key: contactProperty.key,
        type: contactProperty.type,
        fallback_value: contactProperty.fallbackValue
    };
    return {
        fallback_value: contactProperty.fallbackValue
    };
}
//#endregion
//#region src/contact-properties/contact-properties.ts
var ContactProperties = class {
    constructor(resend){
        this.resend = resend;
    }
    async create(options) {
        const apiOptions = parseContactPropertyToApiOptions(options);
        return await this.resend.post("/contact-properties", apiOptions);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/contact-properties?${queryString}` : "/contact-properties";
        const response = await this.resend.get(url);
        if (response.data) return {
            data: {
                ...response.data,
                data: response.data.data.map((apiContactProperty)=>parseContactPropertyFromApi(apiContactProperty))
            },
            headers: response.headers,
            error: null
        };
        return response;
    }
    async get(id) {
        if (!id) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        const response = await this.resend.get(`/contact-properties/${id}`);
        if (response.data) return {
            data: {
                object: "contact_property",
                ...parseContactPropertyFromApi(response.data)
            },
            headers: response.headers,
            error: null
        };
        return response;
    }
    async update(payload) {
        if (!payload.id) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        const apiOptions = parseContactPropertyToApiOptions(payload);
        return await this.resend.patch(`/contact-properties/${payload.id}`, apiOptions);
    }
    async remove(id) {
        if (!id) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        return await this.resend.delete(`/contact-properties/${id}`);
    }
};
//#endregion
//#region src/contacts/segments/contact-segments.ts
var ContactSegments = class {
    constructor(resend){
        this.resend = resend;
    }
    async list(options) {
        if (!options.contactId && !options.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        const identifier = options.email ? options.email : options.contactId;
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/contacts/${identifier}/segments?${queryString}` : `/contacts/${identifier}/segments`;
        return await this.resend.get(url);
    }
    async add(options) {
        if (!options.contactId && !options.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        const identifier = options.email ? options.email : options.contactId;
        return this.resend.post(`/contacts/${identifier}/segments/${options.segmentId}`);
    }
    async remove(options) {
        if (!options.contactId && !options.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        const identifier = options.email ? options.email : options.contactId;
        return this.resend.delete(`/contacts/${identifier}/segments/${options.segmentId}`);
    }
};
//#endregion
//#region src/contacts/topics/contact-topics.ts
var ContactTopics = class {
    constructor(resend){
        this.resend = resend;
    }
    async update(payload) {
        if (!payload.id && !payload.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        const identifier = payload.email ? payload.email : payload.id;
        return this.resend.patch(`/contacts/${identifier}/topics`, payload.topics);
    }
    async list(options) {
        if (!options.id && !options.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        const identifier = options.email ? options.email : options.id;
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/contacts/${identifier}/topics?${queryString}` : `/contacts/${identifier}/topics`;
        return this.resend.get(url);
    }
};
//#endregion
//#region src/contacts/contacts.ts
var Contacts = class {
    constructor(resend){
        this.resend = resend;
        this.topics = new ContactTopics(this.resend);
        this.segments = new ContactSegments(this.resend);
    }
    async create(payload, options = {}) {
        if ("audienceId" in payload) {
            if ("segments" in payload || "topics" in payload) return {
                data: null,
                headers: null,
                error: {
                    message: "`audienceId` is deprecated, and cannot be used together with `segments` or `topics`. Use `segments` instead to add one or more segments to the new contact.",
                    statusCode: null,
                    name: "invalid_parameter"
                }
            };
            return await this.resend.post(`/audiences/${payload.audienceId}/contacts`, {
                unsubscribed: payload.unsubscribed,
                email: payload.email,
                first_name: payload.firstName,
                last_name: payload.lastName,
                properties: payload.properties
            }, options);
        }
        return await this.resend.post("/contacts", {
            unsubscribed: payload.unsubscribed,
            email: payload.email,
            first_name: payload.firstName,
            last_name: payload.lastName,
            properties: payload.properties,
            segments: payload.segments,
            topics: payload.topics
        }, options);
    }
    async list(options = {}) {
        const segmentId = options.segmentId ?? options.audienceId;
        if (!segmentId) {
            const queryString = buildPaginationQuery(options);
            const url = queryString ? `/contacts?${queryString}` : "/contacts";
            return await this.resend.get(url);
        }
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/segments/${segmentId}/contacts?${queryString}` : `/segments/${segmentId}/contacts`;
        return await this.resend.get(url);
    }
    async get(options) {
        if (typeof options === "string") return this.resend.get(`/contacts/${options}`);
        if (!options.id && !options.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        if (!options.audienceId) return this.resend.get(`/contacts/${options?.email ? options?.email : options?.id}`);
        return this.resend.get(`/audiences/${options.audienceId}/contacts/${options?.email ? options?.email : options?.id}`);
    }
    async update(options) {
        if (!options.id && !options.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        if (!options.audienceId) return await this.resend.patch(`/contacts/${options?.email ? options?.email : options?.id}`, {
            unsubscribed: options.unsubscribed,
            first_name: options.firstName,
            last_name: options.lastName,
            properties: options.properties
        });
        return await this.resend.patch(`/audiences/${options.audienceId}/contacts/${options?.email ? options?.email : options?.id}`, {
            unsubscribed: options.unsubscribed,
            first_name: options.firstName,
            last_name: options.lastName,
            properties: options.properties
        });
    }
    async remove(payload) {
        if (typeof payload === "string") return this.resend.delete(`/contacts/${payload}`);
        if (!payload.id && !payload.email) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` or `email` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        if (!payload.audienceId) return this.resend.delete(`/contacts/${payload?.email ? payload?.email : payload?.id}`);
        return this.resend.delete(`/audiences/${payload.audienceId}/contacts/${payload?.email ? payload?.email : payload?.id}`);
    }
};
//#endregion
//#region src/common/utils/parse-domain-to-api-options.ts
function parseDomainToApiOptions(domain) {
    return {
        name: domain.name,
        region: domain.region,
        custom_return_path: domain.customReturnPath,
        capabilities: domain.capabilities,
        open_tracking: domain.openTracking,
        click_tracking: domain.clickTracking,
        tls: domain.tls,
        tracking_subdomain: domain.trackingSubdomain
    };
}
//#endregion
//#region src/domains/domains.ts
var Domains = class {
    constructor(resend){
        this.resend = resend;
    }
    async create(payload, options = {}) {
        return await this.resend.post("/domains", parseDomainToApiOptions(payload), options);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/domains?${queryString}` : "/domains";
        return await this.resend.get(url);
    }
    async get(id) {
        return await this.resend.get(`/domains/${id}`);
    }
    async update(payload) {
        return await this.resend.patch(`/domains/${payload.id}`, {
            click_tracking: payload.clickTracking,
            open_tracking: payload.openTracking,
            tls: payload.tls,
            capabilities: payload.capabilities,
            tracking_subdomain: payload.trackingSubdomain
        });
    }
    async remove(id) {
        return await this.resend.delete(`/domains/${id}`);
    }
    async verify(id) {
        return await this.resend.post(`/domains/${id}/verify`);
    }
};
//#endregion
//#region src/emails/attachments/attachments.ts
var Attachments$1 = class {
    constructor(resend){
        this.resend = resend;
    }
    async get(options) {
        const { emailId, id } = options;
        return await this.resend.get(`/emails/${emailId}/attachments/${id}`);
    }
    async list(options) {
        const { emailId } = options;
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/emails/${emailId}/attachments?${queryString}` : `/emails/${emailId}/attachments`;
        return await this.resend.get(url);
    }
};
//#endregion
//#region src/emails/receiving/attachments/attachments.ts
var Attachments = class {
    constructor(resend){
        this.resend = resend;
    }
    async get(options) {
        const { emailId, id } = options;
        return await this.resend.get(`/emails/receiving/${emailId}/attachments/${id}`);
    }
    async list(options) {
        const { emailId } = options;
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/emails/receiving/${emailId}/attachments?${queryString}` : `/emails/receiving/${emailId}/attachments`;
        return await this.resend.get(url);
    }
};
//#endregion
//#region src/emails/receiving/receiving.ts
var Receiving = class {
    constructor(resend){
        this.resend = resend;
        this.attachments = new Attachments(resend);
    }
    async get(id) {
        return await this.resend.get(`/emails/receiving/${id}`);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/emails/receiving?${queryString}` : "/emails/receiving";
        return await this.resend.get(url);
    }
    async forward(options) {
        const { emailId, to, from } = options;
        const passthrough = options.passthrough !== false;
        const emailResponse = await this.get(emailId);
        if (emailResponse.error) return {
            data: null,
            error: emailResponse.error,
            headers: emailResponse.headers
        };
        const email = emailResponse.data;
        const originalSubject = email.subject || "(no subject)";
        if (passthrough) return this.forwardPassthrough(email, {
            to,
            from,
            subject: originalSubject
        });
        const forwardSubject = originalSubject.startsWith("Fwd:") ? originalSubject : `Fwd: ${originalSubject}`;
        return this.forwardWrapped(email, {
            to,
            from,
            subject: forwardSubject,
            text: "text" in options ? options.text : void 0,
            html: "html" in options ? options.html : void 0
        });
    }
    async forwardPassthrough(email, options) {
        const { to, from, subject } = options;
        if (!email.raw?.download_url) return {
            data: null,
            error: {
                name: "validation_error",
                message: "Raw email content is not available for this email",
                statusCode: 400
            },
            headers: null
        };
        const rawResponse = await fetch(email.raw.download_url);
        if (!rawResponse.ok) return {
            data: null,
            error: {
                name: "application_error",
                message: "Failed to download raw email content",
                statusCode: rawResponse.status
            },
            headers: null
        };
        const rawEmailContent = await rawResponse.text();
        const parsed = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$postal$2d$mime$2f$src$2f$postal$2d$mime$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"].parse(rawEmailContent, {
            attachmentEncoding: "base64"
        });
        const attachments = parsed.attachments.map((attachment)=>{
            const contentId = attachment.contentId ? attachment.contentId.replace(/^<|>$/g, "") : void 0;
            return {
                filename: attachment.filename,
                content: attachment.content.toString(),
                content_type: attachment.mimeType,
                content_id: contentId || void 0
            };
        });
        return await this.resend.post("/emails", {
            from,
            to,
            subject,
            text: parsed.text || void 0,
            html: parsed.html || void 0,
            attachments: attachments.length > 0 ? attachments : void 0
        });
    }
    async forwardWrapped(email, options) {
        const { to, from, subject, text, html } = options;
        if (!email.raw?.download_url) return {
            data: null,
            error: {
                name: "validation_error",
                message: "Raw email content is not available for this email",
                statusCode: 400
            },
            headers: null
        };
        const rawResponse = await fetch(email.raw.download_url);
        if (!rawResponse.ok) return {
            data: null,
            error: {
                name: "application_error",
                message: "Failed to download raw email content",
                statusCode: rawResponse.status
            },
            headers: null
        };
        const rawEmailContent = await rawResponse.text();
        return await this.resend.post("/emails", {
            from,
            to,
            subject,
            text,
            html,
            attachments: [
                {
                    filename: "forwarded_message.eml",
                    content: Buffer.from(rawEmailContent).toString("base64"),
                    content_type: "message/rfc822"
                }
            ]
        });
    }
};
//#endregion
//#region src/emails/emails.ts
var Emails = class {
    constructor(resend){
        this.resend = resend;
        this.attachments = new Attachments$1(resend);
        this.receiving = new Receiving(resend);
    }
    async send(payload, options = {}) {
        return this.create(payload, options);
    }
    async create(payload, options = {}) {
        if (payload.react) payload.html = await render(payload.react);
        return await this.resend.post("/emails", parseEmailToApiOptions(payload), options);
    }
    async get(id) {
        return await this.resend.get(`/emails/${id}`);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/emails?${queryString}` : "/emails";
        return await this.resend.get(url);
    }
    async update(payload) {
        return await this.resend.patch(`/emails/${payload.id}`, {
            scheduled_at: payload.scheduledAt
        });
    }
    async cancel(id) {
        return await this.resend.post(`/emails/${id}/cancel`);
    }
};
//#endregion
//#region src/events/events.ts
var Events = class {
    constructor(resend){
        this.resend = resend;
    }
    async send(payload) {
        return await this.resend.post("/events/send", parseEventToApiOptions(payload));
    }
    async create(payload) {
        return await this.resend.post("/events", payload);
    }
    async get(identifier) {
        return await this.resend.get(`/events/${encodeURIComponent(identifier)}`);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/events?${queryString}` : "/events";
        return await this.resend.get(url);
    }
    async update(identifier, payload) {
        return await this.resend.patch(`/events/${encodeURIComponent(identifier)}`, payload);
    }
    async remove(identifier) {
        return await this.resend.delete(`/events/${encodeURIComponent(identifier)}`);
    }
};
//#endregion
//#region src/logs/logs.ts
var Logs = class {
    constructor(resend){
        this.resend = resend;
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/logs?${queryString}` : "/logs";
        return await this.resend.get(url);
    }
    async get(id) {
        return await this.resend.get(`/logs/${id}`);
    }
};
//#endregion
//#region src/segments/segments.ts
var Segments = class {
    constructor(resend){
        this.resend = resend;
    }
    async create(payload, options = {}) {
        return await this.resend.post("/segments", payload, options);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/segments?${queryString}` : "/segments";
        return await this.resend.get(url);
    }
    async get(id) {
        return await this.resend.get(`/segments/${id}`);
    }
    async remove(id) {
        return await this.resend.delete(`/segments/${id}`);
    }
};
//#endregion
//#region src/common/utils/get-pagination-query-properties.ts
function getPaginationQueryProperties(options = {}) {
    const query = new URLSearchParams();
    if (options.before) query.set("before", options.before);
    if (options.after) query.set("after", options.after);
    if (options.limit) query.set("limit", options.limit.toString());
    return query.size > 0 ? `?${query.toString()}` : "";
}
//#endregion
//#region src/common/utils/parse-template-to-api-options.ts
function parseVariables(variables) {
    return variables?.map((variable)=>({
            key: variable.key,
            type: variable.type,
            fallback_value: variable.fallbackValue
        }));
}
function parseTemplateToApiOptions(template) {
    return {
        name: "name" in template ? template.name : void 0,
        subject: template.subject,
        html: template.html,
        text: template.text,
        alias: template.alias,
        from: template.from,
        reply_to: template.replyTo,
        variables: parseVariables(template.variables)
    };
}
//#endregion
//#region src/templates/chainable-template-result.ts
var ChainableTemplateResult = class {
    constructor(promise, publishFn){
        this.promise = promise;
        this.publishFn = publishFn;
    }
    then(onfulfilled, onrejected) {
        return this.promise.then(onfulfilled, onrejected);
    }
    async publish() {
        const { data, error } = await this.promise;
        if (error) return {
            data: null,
            headers: null,
            error
        };
        return this.publishFn(data.id);
    }
};
//#endregion
//#region src/templates/templates.ts
var Templates = class {
    constructor(resend){
        this.resend = resend;
    }
    create(payload) {
        return new ChainableTemplateResult(this.performCreate(payload), this.publish.bind(this));
    }
    async performCreate(payload) {
        if (payload.react) {
            if (!this.renderAsync) try {
                const { renderAsync } = await Promise.resolve().then(()=>{
                    const e = new Error("Cannot find module '@react-email/render'");
                    e.code = 'MODULE_NOT_FOUND';
                    throw e;
                });
                this.renderAsync = renderAsync;
            } catch  {
                throw new Error("Failed to render React component. Make sure to install `@react-email/render`");
            }
            payload.html = await this.renderAsync(payload.react);
        }
        return this.resend.post("/templates", parseTemplateToApiOptions(payload));
    }
    async remove(identifier) {
        return await this.resend.delete(`/templates/${identifier}`);
    }
    async get(identifier) {
        return await this.resend.get(`/templates/${identifier}`);
    }
    async list(options = {}) {
        return this.resend.get(`/templates${getPaginationQueryProperties(options)}`);
    }
    duplicate(identifier) {
        return new ChainableTemplateResult(this.resend.post(`/templates/${identifier}/duplicate`), this.publish.bind(this));
    }
    async publish(identifier) {
        return await this.resend.post(`/templates/${identifier}/publish`);
    }
    async update(identifier, payload) {
        return await this.resend.patch(`/templates/${identifier}`, parseTemplateToApiOptions(payload));
    }
};
//#endregion
//#region src/topics/topics.ts
var Topics = class {
    constructor(resend){
        this.resend = resend;
    }
    async create(payload) {
        const { defaultSubscription, ...body } = payload;
        return await this.resend.post("/topics", {
            ...body,
            default_subscription: defaultSubscription
        });
    }
    async list() {
        return await this.resend.get("/topics");
    }
    async get(id) {
        if (!id) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        return await this.resend.get(`/topics/${id}`);
    }
    async update(payload) {
        if (!payload.id) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        return await this.resend.patch(`/topics/${payload.id}`, payload);
    }
    async remove(id) {
        if (!id) return {
            data: null,
            headers: null,
            error: {
                message: "Missing `id` field.",
                statusCode: null,
                name: "missing_required_field"
            }
        };
        return await this.resend.delete(`/topics/${id}`);
    }
};
//#endregion
//#region src/webhooks/webhooks.ts
var Webhooks = class {
    constructor(resend){
        this.resend = resend;
    }
    async create(payload, options = {}) {
        return await this.resend.post("/webhooks", payload, options);
    }
    async get(id) {
        return await this.resend.get(`/webhooks/${id}`);
    }
    async list(options = {}) {
        const queryString = buildPaginationQuery(options);
        const url = queryString ? `/webhooks?${queryString}` : "/webhooks";
        return await this.resend.get(url);
    }
    async update(id, payload) {
        return await this.resend.patch(`/webhooks/${id}`, payload);
    }
    async remove(id) {
        return await this.resend.delete(`/webhooks/${id}`);
    }
    verify(payload) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$svix$2f$dist$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Webhook"](payload.webhookSecret).verify(payload.payload, {
            "svix-id": payload.headers.id,
            "svix-timestamp": payload.headers.timestamp,
            "svix-signature": payload.headers.signature
        });
    }
};
//#endregion
//#region src/resend.ts
const defaultBaseUrl = "https://api.resend.com";
const defaultUserAgent = `resend-node:${version}`;
const baseUrl = typeof process !== "undefined" && process.env ? process.env.RESEND_BASE_URL || defaultBaseUrl : defaultBaseUrl;
const userAgent = typeof process !== "undefined" && process.env ? process.env.RESEND_USER_AGENT || defaultUserAgent : defaultUserAgent;
var Resend = class {
    constructor(key){
        this.key = key;
        this.segments = new Segments(this);
        this.apiKeys = new ApiKeys(this);
        this.audiences = this.segments;
        this.automations = new Automations(this);
        this.batch = new Batch(this);
        this.broadcasts = new Broadcasts(this);
        this.contactProperties = new ContactProperties(this);
        this.contacts = new Contacts(this);
        this.domains = new Domains(this);
        this.emails = new Emails(this);
        this.events = new Events(this);
        this.logs = new Logs(this);
        this.templates = new Templates(this);
        this.topics = new Topics(this);
        this.webhooks = new Webhooks(this);
        if (!key) {
            if (typeof process !== "undefined" && process.env) this.key = process.env.RESEND_API_KEY;
            if (!this.key) throw new Error("Missing API key. Pass it to the constructor `new Resend(\"re_123\")`");
        }
        this.headers = new Headers({
            Authorization: `Bearer ${this.key}`,
            "User-Agent": userAgent,
            "Content-Type": "application/json"
        });
    }
    async fetchRequest(path, options = {}) {
        try {
            const response = await fetch(`${baseUrl}${path}`, options);
            if (!response.ok) try {
                const rawError = await response.text();
                return {
                    data: null,
                    error: JSON.parse(rawError),
                    headers: Object.fromEntries(response.headers.entries())
                };
            } catch (err) {
                if (err instanceof SyntaxError) return {
                    data: null,
                    error: {
                        name: "application_error",
                        statusCode: response.status,
                        message: "Internal server error. We are unable to process your request right now, please try again later."
                    },
                    headers: Object.fromEntries(response.headers.entries())
                };
                const error = {
                    message: response.statusText,
                    statusCode: response.status,
                    name: "application_error"
                };
                if (err instanceof Error) return {
                    data: null,
                    error: {
                        ...error,
                        message: err.message
                    },
                    headers: Object.fromEntries(response.headers.entries())
                };
                return {
                    data: null,
                    error,
                    headers: Object.fromEntries(response.headers.entries())
                };
            }
            return {
                data: await response.json(),
                error: null,
                headers: Object.fromEntries(response.headers.entries())
            };
        } catch  {
            return {
                data: null,
                error: {
                    name: "application_error",
                    statusCode: null,
                    message: "Unable to fetch data. The request could not be resolved."
                },
                headers: null
            };
        }
    }
    async post(path, entity, options = {}) {
        const headers = new Headers(this.headers);
        if (options.headers) for (const [key, value] of new Headers(options.headers).entries())headers.set(key, value);
        if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
        const requestOptions = {
            method: "POST",
            body: JSON.stringify(entity),
            ...options,
            headers
        };
        return this.fetchRequest(path, requestOptions);
    }
    async get(path, options = {}) {
        const headers = new Headers(this.headers);
        if (options.headers) for (const [key, value] of new Headers(options.headers).entries())headers.set(key, value);
        const requestOptions = {
            method: "GET",
            ...options,
            headers
        };
        return this.fetchRequest(path, requestOptions);
    }
    async put(path, entity, options = {}) {
        const headers = new Headers(this.headers);
        if (options.headers) for (const [key, value] of new Headers(options.headers).entries())headers.set(key, value);
        const requestOptions = {
            method: "PUT",
            body: JSON.stringify(entity),
            ...options,
            headers
        };
        return this.fetchRequest(path, requestOptions);
    }
    async patch(path, entity, options = {}) {
        const headers = new Headers(this.headers);
        if (options.headers) for (const [key, value] of new Headers(options.headers).entries())headers.set(key, value);
        const requestOptions = {
            method: "PATCH",
            body: JSON.stringify(entity),
            ...options,
            headers
        };
        return this.fetchRequest(path, requestOptions);
    }
    async delete(path, query) {
        const requestOptions = {
            method: "DELETE",
            body: JSON.stringify(query),
            headers: this.headers
        };
        return this.fetchRequest(path, requestOptions);
    }
};
;
}),
"[project]/node_modules/domelementtype/lib/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Doctype = exports.CDATA = exports.Tag = exports.Style = exports.Script = exports.Comment = exports.Directive = exports.Text = exports.Root = exports.isTag = exports.ElementType = void 0;
/** Types of elements found in htmlparser2's DOM */ var ElementType;
(function(ElementType) {
    /** Type for the root element of a document */ ElementType["Root"] = "root";
    /** Type for Text */ ElementType["Text"] = "text";
    /** Type for <? ... ?> */ ElementType["Directive"] = "directive";
    /** Type for <!-- ... --> */ ElementType["Comment"] = "comment";
    /** Type for <script> tags */ ElementType["Script"] = "script";
    /** Type for <style> tags */ ElementType["Style"] = "style";
    /** Type for Any tag */ ElementType["Tag"] = "tag";
    /** Type for <![CDATA[ ... ]]> */ ElementType["CDATA"] = "cdata";
    /** Type for <!doctype ...> */ ElementType["Doctype"] = "doctype";
})(ElementType = exports.ElementType || (exports.ElementType = {}));
/**
 * Tests whether an element is a tag or not.
 *
 * @param elem Element to test
 */ function isTag(elem) {
    return elem.type === ElementType.Tag || elem.type === ElementType.Script || elem.type === ElementType.Style;
}
exports.isTag = isTag;
// Exports for backwards compatibility
/** Type for the root element of a document */ exports.Root = ElementType.Root;
/** Type for Text */ exports.Text = ElementType.Text;
/** Type for <? ... ?> */ exports.Directive = ElementType.Directive;
/** Type for <!-- ... --> */ exports.Comment = ElementType.Comment;
/** Type for <script> tags */ exports.Script = ElementType.Script;
/** Type for <style> tags */ exports.Style = ElementType.Style;
/** Type for Any tag */ exports.Tag = ElementType.Tag;
/** Type for <![CDATA[ ... ]]> */ exports.CDATA = ElementType.CDATA;
/** Type for <!doctype ...> */ exports.Doctype = ElementType.Doctype;
}),
"[project]/node_modules/domhandler/lib/node.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __extends = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || ({
            __proto__: []
        }) instanceof Array && function(d, b) {
            d.__proto__ = b;
        } || function(d, b) {
            for(var p in b)if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p];
        };
        return extendStatics(d, b);
    };
    return function(d, b) {
        if (typeof b !== "function" && b !== null) throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
            this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
}();
var __assign = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__assign || function() {
    __assign = Object.assign || function(t) {
        for(var s, i = 1, n = arguments.length; i < n; i++){
            s = arguments[i];
            for(var p in s)if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.cloneNode = exports.hasChildren = exports.isDocument = exports.isDirective = exports.isComment = exports.isText = exports.isCDATA = exports.isTag = exports.Element = exports.Document = exports.CDATA = exports.NodeWithChildren = exports.ProcessingInstruction = exports.Comment = exports.Text = exports.DataNode = exports.Node = void 0;
var domelementtype_1 = __turbopack_context__.r("[project]/node_modules/domelementtype/lib/index.js [app-route] (ecmascript)");
/**
 * This object will be used as the prototype for Nodes when creating a
 * DOM-Level-1-compliant structure.
 */ var Node = function() {
    function Node() {
        /** Parent of the node */ this.parent = null;
        /** Previous sibling */ this.prev = null;
        /** Next sibling */ this.next = null;
        /** The start index of the node. Requires `withStartIndices` on the handler to be `true. */ this.startIndex = null;
        /** The end index of the node. Requires `withEndIndices` on the handler to be `true. */ this.endIndex = null;
    }
    Object.defineProperty(Node.prototype, "parentNode", {
        // Read-write aliases for properties
        /**
         * Same as {@link parent}.
         * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
         */ get: function() {
            return this.parent;
        },
        set: function(parent) {
            this.parent = parent;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Node.prototype, "previousSibling", {
        /**
         * Same as {@link prev}.
         * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
         */ get: function() {
            return this.prev;
        },
        set: function(prev) {
            this.prev = prev;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Node.prototype, "nextSibling", {
        /**
         * Same as {@link next}.
         * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
         */ get: function() {
            return this.next;
        },
        set: function(next) {
            this.next = next;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Clone this node, and optionally its children.
     *
     * @param recursive Clone child nodes as well.
     * @returns A clone of the node.
     */ Node.prototype.cloneNode = function(recursive) {
        if (recursive === void 0) {
            recursive = false;
        }
        return cloneNode(this, recursive);
    };
    return Node;
}();
exports.Node = Node;
/**
 * A node that contains some data.
 */ var DataNode = function(_super) {
    __extends(DataNode, _super);
    /**
     * @param data The content of the data node
     */ function DataNode(data) {
        var _this = _super.call(this) || this;
        _this.data = data;
        return _this;
    }
    Object.defineProperty(DataNode.prototype, "nodeValue", {
        /**
         * Same as {@link data}.
         * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
         */ get: function() {
            return this.data;
        },
        set: function(data) {
            this.data = data;
        },
        enumerable: false,
        configurable: true
    });
    return DataNode;
}(Node);
exports.DataNode = DataNode;
/**
 * Text within the document.
 */ var Text = function(_super) {
    __extends(Text, _super);
    function Text() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.type = domelementtype_1.ElementType.Text;
        return _this;
    }
    Object.defineProperty(Text.prototype, "nodeType", {
        get: function() {
            return 3;
        },
        enumerable: false,
        configurable: true
    });
    return Text;
}(DataNode);
exports.Text = Text;
/**
 * Comments within the document.
 */ var Comment = function(_super) {
    __extends(Comment, _super);
    function Comment() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.type = domelementtype_1.ElementType.Comment;
        return _this;
    }
    Object.defineProperty(Comment.prototype, "nodeType", {
        get: function() {
            return 8;
        },
        enumerable: false,
        configurable: true
    });
    return Comment;
}(DataNode);
exports.Comment = Comment;
/**
 * Processing instructions, including doc types.
 */ var ProcessingInstruction = function(_super) {
    __extends(ProcessingInstruction, _super);
    function ProcessingInstruction(name, data) {
        var _this = _super.call(this, data) || this;
        _this.name = name;
        _this.type = domelementtype_1.ElementType.Directive;
        return _this;
    }
    Object.defineProperty(ProcessingInstruction.prototype, "nodeType", {
        get: function() {
            return 1;
        },
        enumerable: false,
        configurable: true
    });
    return ProcessingInstruction;
}(DataNode);
exports.ProcessingInstruction = ProcessingInstruction;
/**
 * A `Node` that can have children.
 */ var NodeWithChildren = function(_super) {
    __extends(NodeWithChildren, _super);
    /**
     * @param children Children of the node. Only certain node types can have children.
     */ function NodeWithChildren(children) {
        var _this = _super.call(this) || this;
        _this.children = children;
        return _this;
    }
    Object.defineProperty(NodeWithChildren.prototype, "firstChild", {
        // Aliases
        /** First child of the node. */ get: function() {
            var _a;
            return (_a = this.children[0]) !== null && _a !== void 0 ? _a : null;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NodeWithChildren.prototype, "lastChild", {
        /** Last child of the node. */ get: function() {
            return this.children.length > 0 ? this.children[this.children.length - 1] : null;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NodeWithChildren.prototype, "childNodes", {
        /**
         * Same as {@link children}.
         * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
         */ get: function() {
            return this.children;
        },
        set: function(children) {
            this.children = children;
        },
        enumerable: false,
        configurable: true
    });
    return NodeWithChildren;
}(Node);
exports.NodeWithChildren = NodeWithChildren;
var CDATA = function(_super) {
    __extends(CDATA, _super);
    function CDATA() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.type = domelementtype_1.ElementType.CDATA;
        return _this;
    }
    Object.defineProperty(CDATA.prototype, "nodeType", {
        get: function() {
            return 4;
        },
        enumerable: false,
        configurable: true
    });
    return CDATA;
}(NodeWithChildren);
exports.CDATA = CDATA;
/**
 * The root node of the document.
 */ var Document = function(_super) {
    __extends(Document, _super);
    function Document() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.type = domelementtype_1.ElementType.Root;
        return _this;
    }
    Object.defineProperty(Document.prototype, "nodeType", {
        get: function() {
            return 9;
        },
        enumerable: false,
        configurable: true
    });
    return Document;
}(NodeWithChildren);
exports.Document = Document;
/**
 * An element within the DOM.
 */ var Element = function(_super) {
    __extends(Element, _super);
    /**
     * @param name Name of the tag, eg. `div`, `span`.
     * @param attribs Object mapping attribute names to attribute values.
     * @param children Children of the node.
     */ function Element(name, attribs, children, type) {
        if (children === void 0) {
            children = [];
        }
        if (type === void 0) {
            type = name === "script" ? domelementtype_1.ElementType.Script : name === "style" ? domelementtype_1.ElementType.Style : domelementtype_1.ElementType.Tag;
        }
        var _this = _super.call(this, children) || this;
        _this.name = name;
        _this.attribs = attribs;
        _this.type = type;
        return _this;
    }
    Object.defineProperty(Element.prototype, "nodeType", {
        get: function() {
            return 1;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Element.prototype, "tagName", {
        // DOM Level 1 aliases
        /**
         * Same as {@link name}.
         * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
         */ get: function() {
            return this.name;
        },
        set: function(name) {
            this.name = name;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Element.prototype, "attributes", {
        get: function() {
            var _this = this;
            return Object.keys(this.attribs).map(function(name) {
                var _a, _b;
                return {
                    name: name,
                    value: _this.attribs[name],
                    namespace: (_a = _this["x-attribsNamespace"]) === null || _a === void 0 ? void 0 : _a[name],
                    prefix: (_b = _this["x-attribsPrefix"]) === null || _b === void 0 ? void 0 : _b[name]
                };
            });
        },
        enumerable: false,
        configurable: true
    });
    return Element;
}(NodeWithChildren);
exports.Element = Element;
/**
 * @param node Node to check.
 * @returns `true` if the node is a `Element`, `false` otherwise.
 */ function isTag(node) {
    return (0, domelementtype_1.isTag)(node);
}
exports.isTag = isTag;
/**
 * @param node Node to check.
 * @returns `true` if the node has the type `CDATA`, `false` otherwise.
 */ function isCDATA(node) {
    return node.type === domelementtype_1.ElementType.CDATA;
}
exports.isCDATA = isCDATA;
/**
 * @param node Node to check.
 * @returns `true` if the node has the type `Text`, `false` otherwise.
 */ function isText(node) {
    return node.type === domelementtype_1.ElementType.Text;
}
exports.isText = isText;
/**
 * @param node Node to check.
 * @returns `true` if the node has the type `Comment`, `false` otherwise.
 */ function isComment(node) {
    return node.type === domelementtype_1.ElementType.Comment;
}
exports.isComment = isComment;
/**
 * @param node Node to check.
 * @returns `true` if the node has the type `ProcessingInstruction`, `false` otherwise.
 */ function isDirective(node) {
    return node.type === domelementtype_1.ElementType.Directive;
}
exports.isDirective = isDirective;
/**
 * @param node Node to check.
 * @returns `true` if the node has the type `ProcessingInstruction`, `false` otherwise.
 */ function isDocument(node) {
    return node.type === domelementtype_1.ElementType.Root;
}
exports.isDocument = isDocument;
/**
 * @param node Node to check.
 * @returns `true` if the node has children, `false` otherwise.
 */ function hasChildren(node) {
    return Object.prototype.hasOwnProperty.call(node, "children");
}
exports.hasChildren = hasChildren;
/**
 * Clone a node, and optionally its children.
 *
 * @param recursive Clone child nodes as well.
 * @returns A clone of the node.
 */ function cloneNode(node, recursive) {
    if (recursive === void 0) {
        recursive = false;
    }
    var result;
    if (isText(node)) {
        result = new Text(node.data);
    } else if (isComment(node)) {
        result = new Comment(node.data);
    } else if (isTag(node)) {
        var children = recursive ? cloneChildren(node.children) : [];
        var clone_1 = new Element(node.name, __assign({}, node.attribs), children);
        children.forEach(function(child) {
            return child.parent = clone_1;
        });
        if (node.namespace != null) {
            clone_1.namespace = node.namespace;
        }
        if (node["x-attribsNamespace"]) {
            clone_1["x-attribsNamespace"] = __assign({}, node["x-attribsNamespace"]);
        }
        if (node["x-attribsPrefix"]) {
            clone_1["x-attribsPrefix"] = __assign({}, node["x-attribsPrefix"]);
        }
        result = clone_1;
    } else if (isCDATA(node)) {
        var children = recursive ? cloneChildren(node.children) : [];
        var clone_2 = new CDATA(children);
        children.forEach(function(child) {
            return child.parent = clone_2;
        });
        result = clone_2;
    } else if (isDocument(node)) {
        var children = recursive ? cloneChildren(node.children) : [];
        var clone_3 = new Document(children);
        children.forEach(function(child) {
            return child.parent = clone_3;
        });
        if (node["x-mode"]) {
            clone_3["x-mode"] = node["x-mode"];
        }
        result = clone_3;
    } else if (isDirective(node)) {
        var instruction = new ProcessingInstruction(node.name, node.data);
        if (node["x-name"] != null) {
            instruction["x-name"] = node["x-name"];
            instruction["x-publicId"] = node["x-publicId"];
            instruction["x-systemId"] = node["x-systemId"];
        }
        result = instruction;
    } else {
        throw new Error("Not implemented yet: ".concat(node.type));
    }
    result.startIndex = node.startIndex;
    result.endIndex = node.endIndex;
    if (node.sourceCodeLocation != null) {
        result.sourceCodeLocation = node.sourceCodeLocation;
    }
    return result;
}
exports.cloneNode = cloneNode;
function cloneChildren(childs) {
    var children = childs.map(function(child) {
        return cloneNode(child, true);
    });
    for(var i = 1; i < children.length; i++){
        children[i].prev = children[i - 1];
        children[i - 1].next = children[i];
    }
    return children;
}
}),
"[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __exportStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__exportStar || function(m, exports1) {
    for(var p in m)if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports1, p)) __createBinding(exports1, m, p);
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DomHandler = void 0;
var domelementtype_1 = __turbopack_context__.r("[project]/node_modules/domelementtype/lib/index.js [app-route] (ecmascript)");
var node_js_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/node.js [app-route] (ecmascript)");
__exportStar(__turbopack_context__.r("[project]/node_modules/domhandler/lib/node.js [app-route] (ecmascript)"), exports);
// Default options
var defaultOpts = {
    withStartIndices: false,
    withEndIndices: false,
    xmlMode: false
};
var DomHandler = function() {
    /**
     * @param callback Called once parsing has completed.
     * @param options Settings for the handler.
     * @param elementCB Callback whenever a tag is closed.
     */ function DomHandler(callback, options, elementCB) {
        /** The elements of the DOM */ this.dom = [];
        /** The root element for the DOM */ this.root = new node_js_1.Document(this.dom);
        /** Indicated whether parsing has been completed. */ this.done = false;
        /** Stack of open tags. */ this.tagStack = [
            this.root
        ];
        /** A data node that is still being written to. */ this.lastNode = null;
        /** Reference to the parser instance. Used for location information. */ this.parser = null;
        // Make it possible to skip arguments, for backwards-compatibility
        if (typeof options === "function") {
            elementCB = options;
            options = defaultOpts;
        }
        if (typeof callback === "object") {
            options = callback;
            callback = undefined;
        }
        this.callback = callback !== null && callback !== void 0 ? callback : null;
        this.options = options !== null && options !== void 0 ? options : defaultOpts;
        this.elementCB = elementCB !== null && elementCB !== void 0 ? elementCB : null;
    }
    DomHandler.prototype.onparserinit = function(parser) {
        this.parser = parser;
    };
    // Resets the handler back to starting state
    DomHandler.prototype.onreset = function() {
        this.dom = [];
        this.root = new node_js_1.Document(this.dom);
        this.done = false;
        this.tagStack = [
            this.root
        ];
        this.lastNode = null;
        this.parser = null;
    };
    // Signals the handler that parsing is done
    DomHandler.prototype.onend = function() {
        if (this.done) return;
        this.done = true;
        this.parser = null;
        this.handleCallback(null);
    };
    DomHandler.prototype.onerror = function(error) {
        this.handleCallback(error);
    };
    DomHandler.prototype.onclosetag = function() {
        this.lastNode = null;
        var elem = this.tagStack.pop();
        if (this.options.withEndIndices) {
            elem.endIndex = this.parser.endIndex;
        }
        if (this.elementCB) this.elementCB(elem);
    };
    DomHandler.prototype.onopentag = function(name, attribs) {
        var type = this.options.xmlMode ? domelementtype_1.ElementType.Tag : undefined;
        var element = new node_js_1.Element(name, attribs, undefined, type);
        this.addNode(element);
        this.tagStack.push(element);
    };
    DomHandler.prototype.ontext = function(data) {
        var lastNode = this.lastNode;
        if (lastNode && lastNode.type === domelementtype_1.ElementType.Text) {
            lastNode.data += data;
            if (this.options.withEndIndices) {
                lastNode.endIndex = this.parser.endIndex;
            }
        } else {
            var node = new node_js_1.Text(data);
            this.addNode(node);
            this.lastNode = node;
        }
    };
    DomHandler.prototype.oncomment = function(data) {
        if (this.lastNode && this.lastNode.type === domelementtype_1.ElementType.Comment) {
            this.lastNode.data += data;
            return;
        }
        var node = new node_js_1.Comment(data);
        this.addNode(node);
        this.lastNode = node;
    };
    DomHandler.prototype.oncommentend = function() {
        this.lastNode = null;
    };
    DomHandler.prototype.oncdatastart = function() {
        var text = new node_js_1.Text("");
        var node = new node_js_1.CDATA([
            text
        ]);
        this.addNode(node);
        text.parent = node;
        this.lastNode = text;
    };
    DomHandler.prototype.oncdataend = function() {
        this.lastNode = null;
    };
    DomHandler.prototype.onprocessinginstruction = function(name, data) {
        var node = new node_js_1.ProcessingInstruction(name, data);
        this.addNode(node);
    };
    DomHandler.prototype.handleCallback = function(error) {
        if (typeof this.callback === "function") {
            this.callback(error, this.dom);
        } else if (error) {
            throw error;
        }
    };
    DomHandler.prototype.addNode = function(node) {
        var parent = this.tagStack[this.tagStack.length - 1];
        var previousSibling = parent.children[parent.children.length - 1];
        if (this.options.withStartIndices) {
            node.startIndex = this.parser.startIndex;
        }
        if (this.options.withEndIndices) {
            node.endIndex = this.parser.endIndex;
        }
        parent.children.push(node);
        if (previousSibling) {
            node.prev = previousSibling;
            previousSibling.next = node;
        }
        node.parent = parent;
        this.lastNode = null;
    };
    return DomHandler;
}();
exports.DomHandler = DomHandler;
exports.default = DomHandler;
}),
"[project]/node_modules/dom-serializer/lib/foreignNames.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.attributeNames = exports.elementNames = void 0;
exports.elementNames = new Map([
    "altGlyph",
    "altGlyphDef",
    "altGlyphItem",
    "animateColor",
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "foreignObject",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath"
].map(function(val) {
    return [
        val.toLowerCase(),
        val
    ];
}));
exports.attributeNames = new Map([
    "definitionURL",
    "attributeName",
    "attributeType",
    "baseFrequency",
    "baseProfile",
    "calcMode",
    "clipPathUnits",
    "diffuseConstant",
    "edgeMode",
    "filterUnits",
    "glyphRef",
    "gradientTransform",
    "gradientUnits",
    "kernelMatrix",
    "kernelUnitLength",
    "keyPoints",
    "keySplines",
    "keyTimes",
    "lengthAdjust",
    "limitingConeAngle",
    "markerHeight",
    "markerUnits",
    "markerWidth",
    "maskContentUnits",
    "maskUnits",
    "numOctaves",
    "pathLength",
    "patternContentUnits",
    "patternTransform",
    "patternUnits",
    "pointsAtX",
    "pointsAtY",
    "pointsAtZ",
    "preserveAlpha",
    "preserveAspectRatio",
    "primitiveUnits",
    "refX",
    "refY",
    "repeatCount",
    "repeatDur",
    "requiredExtensions",
    "requiredFeatures",
    "specularConstant",
    "specularExponent",
    "spreadMethod",
    "startOffset",
    "stdDeviation",
    "stitchTiles",
    "surfaceScale",
    "systemLanguage",
    "tableValues",
    "targetX",
    "targetY",
    "textLength",
    "viewBox",
    "viewTarget",
    "xChannelSelector",
    "yChannelSelector",
    "zoomAndPan"
].map(function(val) {
    return [
        val.toLowerCase(),
        val
    ];
}));
}),
"[project]/node_modules/dom-serializer/lib/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __assign = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__assign || function() {
    __assign = Object.assign || function(t) {
        for(var s, i = 1, n = arguments.length; i < n; i++){
            s = arguments[i];
            for(var p in s)if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importStar || function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) {
        for(var k in mod)if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    }
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.render = void 0;
/*
 * Module dependencies
 */ var ElementType = __importStar(__turbopack_context__.r("[project]/node_modules/domelementtype/lib/index.js [app-route] (ecmascript)"));
var entities_1 = __turbopack_context__.r("[project]/node_modules/dom-serializer/node_modules/entities/lib/index.js [app-route] (ecmascript)");
/**
 * Mixed-case SVG and MathML tags & attributes
 * recognized by the HTML parser.
 *
 * @see https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inforeign
 */ var foreignNames_js_1 = __turbopack_context__.r("[project]/node_modules/dom-serializer/lib/foreignNames.js [app-route] (ecmascript)");
var unencodedElements = new Set([
    "style",
    "script",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
    "plaintext",
    "noscript"
]);
function replaceQuotes(value) {
    return value.replace(/"/g, "&quot;");
}
/**
 * Format attributes
 */ function formatAttributes(attributes, opts) {
    var _a;
    if (!attributes) return;
    var encode = ((_a = opts.encodeEntities) !== null && _a !== void 0 ? _a : opts.decodeEntities) === false ? replaceQuotes : opts.xmlMode || opts.encodeEntities !== "utf8" ? entities_1.encodeXML : entities_1.escapeAttribute;
    return Object.keys(attributes).map(function(key) {
        var _a, _b;
        var value = (_a = attributes[key]) !== null && _a !== void 0 ? _a : "";
        if (opts.xmlMode === "foreign") {
            /* Fix up mixed-case attribute names */ key = (_b = foreignNames_js_1.attributeNames.get(key)) !== null && _b !== void 0 ? _b : key;
        }
        if (!opts.emptyAttrs && !opts.xmlMode && value === "") {
            return key;
        }
        return "".concat(key, "=\"").concat(encode(value), "\"");
    }).join(" ");
}
/**
 * Self-enclosing tags
 */ var singleTag = new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
]);
/**
 * Renders a DOM node or an array of DOM nodes to a string.
 *
 * Can be thought of as the equivalent of the `outerHTML` of the passed node(s).
 *
 * @param node Node to be rendered.
 * @param options Changes serialization behavior
 */ function render(node, options) {
    if (options === void 0) {
        options = {};
    }
    var nodes = "length" in node ? node : [
        node
    ];
    var output = "";
    for(var i = 0; i < nodes.length; i++){
        output += renderNode(nodes[i], options);
    }
    return output;
}
exports.render = render;
exports.default = render;
function renderNode(node, options) {
    switch(node.type){
        case ElementType.Root:
            return render(node.children, options);
        // @ts-expect-error We don't use `Doctype` yet
        case ElementType.Doctype:
        case ElementType.Directive:
            return renderDirective(node);
        case ElementType.Comment:
            return renderComment(node);
        case ElementType.CDATA:
            return renderCdata(node);
        case ElementType.Script:
        case ElementType.Style:
        case ElementType.Tag:
            return renderTag(node, options);
        case ElementType.Text:
            return renderText(node, options);
    }
}
var foreignModeIntegrationPoints = new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignObject",
    "desc",
    "title"
]);
var foreignElements = new Set([
    "svg",
    "math"
]);
function renderTag(elem, opts) {
    var _a;
    // Handle SVG / MathML in HTML
    if (opts.xmlMode === "foreign") {
        /* Fix up mixed-case element names */ elem.name = (_a = foreignNames_js_1.elementNames.get(elem.name)) !== null && _a !== void 0 ? _a : elem.name;
        /* Exit foreign mode at integration points */ if (elem.parent && foreignModeIntegrationPoints.has(elem.parent.name)) {
            opts = __assign(__assign({}, opts), {
                xmlMode: false
            });
        }
    }
    if (!opts.xmlMode && foreignElements.has(elem.name)) {
        opts = __assign(__assign({}, opts), {
            xmlMode: "foreign"
        });
    }
    var tag = "<".concat(elem.name);
    var attribs = formatAttributes(elem.attribs, opts);
    if (attribs) {
        tag += " ".concat(attribs);
    }
    if (elem.children.length === 0 && (opts.xmlMode ? opts.selfClosingTags !== false : opts.selfClosingTags && singleTag.has(elem.name))) {
        if (!opts.xmlMode) tag += " ";
        tag += "/>";
    } else {
        tag += ">";
        if (elem.children.length > 0) {
            tag += render(elem.children, opts);
        }
        if (opts.xmlMode || !singleTag.has(elem.name)) {
            tag += "</".concat(elem.name, ">");
        }
    }
    return tag;
}
function renderDirective(elem) {
    return "<".concat(elem.data, ">");
}
function renderText(elem, opts) {
    var _a;
    var data = elem.data || "";
    // If entities weren't decoded, no need to encode them back
    if (((_a = opts.encodeEntities) !== null && _a !== void 0 ? _a : opts.decodeEntities) !== false && !(!opts.xmlMode && elem.parent && unencodedElements.has(elem.parent.name))) {
        data = opts.xmlMode || opts.encodeEntities !== "utf8" ? (0, entities_1.encodeXML)(data) : (0, entities_1.escapeText)(data);
    }
    return data;
}
function renderCdata(elem) {
    return "<![CDATA[".concat(elem.children[0].data, "]]>");
}
function renderComment(elem) {
    return "<!--".concat(elem.data, "-->");
}
}),
"[project]/node_modules/domutils/lib/stringify.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getOuterHTML = getOuterHTML;
exports.getInnerHTML = getInnerHTML;
exports.getText = getText;
exports.textContent = textContent;
exports.innerText = innerText;
var domhandler_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
var dom_serializer_1 = __importDefault(__turbopack_context__.r("[project]/node_modules/dom-serializer/lib/index.js [app-route] (ecmascript)"));
var domelementtype_1 = __turbopack_context__.r("[project]/node_modules/domelementtype/lib/index.js [app-route] (ecmascript)");
/**
 * @category Stringify
 * @deprecated Use the `dom-serializer` module directly.
 * @param node Node to get the outer HTML of.
 * @param options Options for serialization.
 * @returns `node`'s outer HTML.
 */ function getOuterHTML(node, options) {
    return (0, dom_serializer_1.default)(node, options);
}
/**
 * @category Stringify
 * @deprecated Use the `dom-serializer` module directly.
 * @param node Node to get the inner HTML of.
 * @param options Options for serialization.
 * @returns `node`'s inner HTML.
 */ function getInnerHTML(node, options) {
    return (0, domhandler_1.hasChildren)(node) ? node.children.map(function(node) {
        return getOuterHTML(node, options);
    }).join("") : "";
}
/**
 * Get a node's inner text. Same as `textContent`, but inserts newlines for `<br>` tags. Ignores comments.
 *
 * @category Stringify
 * @deprecated Use `textContent` instead.
 * @param node Node to get the inner text of.
 * @returns `node`'s inner text.
 */ function getText(node) {
    if (Array.isArray(node)) return node.map(getText).join("");
    if ((0, domhandler_1.isTag)(node)) return node.name === "br" ? "\n" : getText(node.children);
    if ((0, domhandler_1.isCDATA)(node)) return getText(node.children);
    if ((0, domhandler_1.isText)(node)) return node.data;
    return "";
}
/**
 * Get a node's text content. Ignores comments.
 *
 * @category Stringify
 * @param node Node to get the text content of.
 * @returns `node`'s text content.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent}
 */ function textContent(node) {
    if (Array.isArray(node)) return node.map(textContent).join("");
    if ((0, domhandler_1.hasChildren)(node) && !(0, domhandler_1.isComment)(node)) {
        return textContent(node.children);
    }
    if ((0, domhandler_1.isText)(node)) return node.data;
    return "";
}
/**
 * Get a node's inner text, ignoring `<script>` and `<style>` tags. Ignores comments.
 *
 * @category Stringify
 * @param node Node to get the inner text of.
 * @returns `node`'s inner text.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Node/innerText}
 */ function innerText(node) {
    if (Array.isArray(node)) return node.map(innerText).join("");
    if ((0, domhandler_1.hasChildren)(node) && (node.type === domelementtype_1.ElementType.Tag || (0, domhandler_1.isCDATA)(node))) {
        return innerText(node.children);
    }
    if ((0, domhandler_1.isText)(node)) return node.data;
    return "";
}
}),
"[project]/node_modules/domutils/lib/traversal.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getChildren = getChildren;
exports.getParent = getParent;
exports.getSiblings = getSiblings;
exports.getAttributeValue = getAttributeValue;
exports.hasAttrib = hasAttrib;
exports.getName = getName;
exports.nextElementSibling = nextElementSibling;
exports.prevElementSibling = prevElementSibling;
var domhandler_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
/**
 * Get a node's children.
 *
 * @category Traversal
 * @param elem Node to get the children of.
 * @returns `elem`'s children, or an empty array.
 */ function getChildren(elem) {
    return (0, domhandler_1.hasChildren)(elem) ? elem.children : [];
}
/**
 * Get a node's parent.
 *
 * @category Traversal
 * @param elem Node to get the parent of.
 * @returns `elem`'s parent node, or `null` if `elem` is a root node.
 */ function getParent(elem) {
    return elem.parent || null;
}
/**
 * Gets an elements siblings, including the element itself.
 *
 * Attempts to get the children through the element's parent first. If we don't
 * have a parent (the element is a root node), we walk the element's `prev` &
 * `next` to get all remaining nodes.
 *
 * @category Traversal
 * @param elem Element to get the siblings of.
 * @returns `elem`'s siblings, including `elem`.
 */ function getSiblings(elem) {
    var _a, _b;
    var parent = getParent(elem);
    if (parent != null) return getChildren(parent);
    var siblings = [
        elem
    ];
    var prev = elem.prev, next = elem.next;
    while(prev != null){
        siblings.unshift(prev);
        _a = prev, prev = _a.prev;
    }
    while(next != null){
        siblings.push(next);
        _b = next, next = _b.next;
    }
    return siblings;
}
/**
 * Gets an attribute from an element.
 *
 * @category Traversal
 * @param elem Element to check.
 * @param name Attribute name to retrieve.
 * @returns The element's attribute value, or `undefined`.
 */ function getAttributeValue(elem, name) {
    var _a;
    return (_a = elem.attribs) === null || _a === void 0 ? void 0 : _a[name];
}
/**
 * Checks whether an element has an attribute.
 *
 * @category Traversal
 * @param elem Element to check.
 * @param name Attribute name to look for.
 * @returns Returns whether `elem` has the attribute `name`.
 */ function hasAttrib(elem, name) {
    return elem.attribs != null && Object.prototype.hasOwnProperty.call(elem.attribs, name) && elem.attribs[name] != null;
}
/**
 * Get the tag name of an element.
 *
 * @category Traversal
 * @param elem The element to get the name for.
 * @returns The tag name of `elem`.
 */ function getName(elem) {
    return elem.name;
}
/**
 * Returns the next element sibling of a node.
 *
 * @category Traversal
 * @param elem The element to get the next sibling of.
 * @returns `elem`'s next sibling that is a tag, or `null` if there is no next
 * sibling.
 */ function nextElementSibling(elem) {
    var _a;
    var next = elem.next;
    while(next !== null && !(0, domhandler_1.isTag)(next))_a = next, next = _a.next;
    return next;
}
/**
 * Returns the previous element sibling of a node.
 *
 * @category Traversal
 * @param elem The element to get the previous sibling of.
 * @returns `elem`'s previous sibling that is a tag, or `null` if there is no
 * previous sibling.
 */ function prevElementSibling(elem) {
    var _a;
    var prev = elem.prev;
    while(prev !== null && !(0, domhandler_1.isTag)(prev))_a = prev, prev = _a.prev;
    return prev;
}
}),
"[project]/node_modules/domutils/lib/manipulation.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.removeElement = removeElement;
exports.replaceElement = replaceElement;
exports.appendChild = appendChild;
exports.append = append;
exports.prependChild = prependChild;
exports.prepend = prepend;
/**
 * Remove an element from the dom
 *
 * @category Manipulation
 * @param elem The element to be removed
 */ function removeElement(elem) {
    if (elem.prev) elem.prev.next = elem.next;
    if (elem.next) elem.next.prev = elem.prev;
    if (elem.parent) {
        var childs = elem.parent.children;
        var childsIndex = childs.lastIndexOf(elem);
        if (childsIndex >= 0) {
            childs.splice(childsIndex, 1);
        }
    }
    elem.next = null;
    elem.prev = null;
    elem.parent = null;
}
/**
 * Replace an element in the dom
 *
 * @category Manipulation
 * @param elem The element to be replaced
 * @param replacement The element to be added
 */ function replaceElement(elem, replacement) {
    var prev = replacement.prev = elem.prev;
    if (prev) {
        prev.next = replacement;
    }
    var next = replacement.next = elem.next;
    if (next) {
        next.prev = replacement;
    }
    var parent = replacement.parent = elem.parent;
    if (parent) {
        var childs = parent.children;
        childs[childs.lastIndexOf(elem)] = replacement;
        elem.parent = null;
    }
}
/**
 * Append a child to an element.
 *
 * @category Manipulation
 * @param parent The element to append to.
 * @param child The element to be added as a child.
 */ function appendChild(parent, child) {
    removeElement(child);
    child.next = null;
    child.parent = parent;
    if (parent.children.push(child) > 1) {
        var sibling = parent.children[parent.children.length - 2];
        sibling.next = child;
        child.prev = sibling;
    } else {
        child.prev = null;
    }
}
/**
 * Append an element after another.
 *
 * @category Manipulation
 * @param elem The element to append after.
 * @param next The element be added.
 */ function append(elem, next) {
    removeElement(next);
    var parent = elem.parent;
    var currNext = elem.next;
    next.next = currNext;
    next.prev = elem;
    elem.next = next;
    next.parent = parent;
    if (currNext) {
        currNext.prev = next;
        if (parent) {
            var childs = parent.children;
            childs.splice(childs.lastIndexOf(currNext), 0, next);
        }
    } else if (parent) {
        parent.children.push(next);
    }
}
/**
 * Prepend a child to an element.
 *
 * @category Manipulation
 * @param parent The element to prepend before.
 * @param child The element to be added as a child.
 */ function prependChild(parent, child) {
    removeElement(child);
    child.parent = parent;
    child.prev = null;
    if (parent.children.unshift(child) !== 1) {
        var sibling = parent.children[1];
        sibling.prev = child;
        child.next = sibling;
    } else {
        child.next = null;
    }
}
/**
 * Prepend an element before another.
 *
 * @category Manipulation
 * @param elem The element to prepend before.
 * @param prev The element be added.
 */ function prepend(elem, prev) {
    removeElement(prev);
    var parent = elem.parent;
    if (parent) {
        var childs = parent.children;
        childs.splice(childs.indexOf(elem), 0, prev);
    }
    if (elem.prev) {
        elem.prev.next = prev;
    }
    prev.parent = parent;
    prev.prev = elem.prev;
    prev.next = elem;
    elem.prev = prev;
}
}),
"[project]/node_modules/domutils/lib/querying.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.filter = filter;
exports.find = find;
exports.findOneChild = findOneChild;
exports.findOne = findOne;
exports.existsOne = existsOne;
exports.findAll = findAll;
var domhandler_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
/**
 * Search a node and its children for nodes passing a test function. If `node` is not an array, it will be wrapped in one.
 *
 * @category Querying
 * @param test Function to test nodes on.
 * @param node Node to search. Will be included in the result set if it matches.
 * @param recurse Also consider child nodes.
 * @param limit Maximum number of nodes to return.
 * @returns All nodes passing `test`.
 */ function filter(test, node, recurse, limit) {
    if (recurse === void 0) {
        recurse = true;
    }
    if (limit === void 0) {
        limit = Infinity;
    }
    return find(test, Array.isArray(node) ? node : [
        node
    ], recurse, limit);
}
/**
 * Search an array of nodes and their children for nodes passing a test function.
 *
 * @category Querying
 * @param test Function to test nodes on.
 * @param nodes Array of nodes to search.
 * @param recurse Also consider child nodes.
 * @param limit Maximum number of nodes to return.
 * @returns All nodes passing `test`.
 */ function find(test, nodes, recurse, limit) {
    var result = [];
    /** Stack of the arrays we are looking at. */ var nodeStack = [
        Array.isArray(nodes) ? nodes : [
            nodes
        ]
    ];
    /** Stack of the indices within the arrays. */ var indexStack = [
        0
    ];
    for(;;){
        // First, check if the current array has any more elements to look at.
        if (indexStack[0] >= nodeStack[0].length) {
            // If we have no more arrays to look at, we are done.
            if (indexStack.length === 1) {
                return result;
            }
            // Otherwise, remove the current array from the stack.
            nodeStack.shift();
            indexStack.shift();
            continue;
        }
        var elem = nodeStack[0][indexStack[0]++];
        if (test(elem)) {
            result.push(elem);
            if (--limit <= 0) return result;
        }
        if (recurse && (0, domhandler_1.hasChildren)(elem) && elem.children.length > 0) {
            /*
             * Add the children to the stack. We are depth-first, so this is
             * the next array we look at.
             */ indexStack.unshift(0);
            nodeStack.unshift(elem.children);
        }
    }
}
/**
 * Finds the first element inside of an array that matches a test function. This is an alias for `Array.prototype.find`.
 *
 * @category Querying
 * @param test Function to test nodes on.
 * @param nodes Array of nodes to search.
 * @returns The first node in the array that passes `test`.
 * @deprecated Use `Array.prototype.find` directly.
 */ function findOneChild(test, nodes) {
    return nodes.find(test);
}
/**
 * Finds one element in a tree that passes a test.
 *
 * @category Querying
 * @param test Function to test nodes on.
 * @param nodes Node or array of nodes to search.
 * @param recurse Also consider child nodes.
 * @returns The first node that passes `test`.
 */ function findOne(test, nodes, recurse) {
    if (recurse === void 0) {
        recurse = true;
    }
    var searchedNodes = Array.isArray(nodes) ? nodes : [
        nodes
    ];
    for(var i = 0; i < searchedNodes.length; i++){
        var node = searchedNodes[i];
        if ((0, domhandler_1.isTag)(node) && test(node)) {
            return node;
        }
        if (recurse && (0, domhandler_1.hasChildren)(node) && node.children.length > 0) {
            var found = findOne(test, node.children, true);
            if (found) return found;
        }
    }
    return null;
}
/**
 * Checks if a tree of nodes contains at least one node passing a test.
 *
 * @category Querying
 * @param test Function to test nodes on.
 * @param nodes Array of nodes to search.
 * @returns Whether a tree of nodes contains at least one node passing the test.
 */ function existsOne(test, nodes) {
    return (Array.isArray(nodes) ? nodes : [
        nodes
    ]).some(function(node) {
        return (0, domhandler_1.isTag)(node) && test(node) || (0, domhandler_1.hasChildren)(node) && existsOne(test, node.children);
    });
}
/**
 * Search an array of nodes and their children for elements passing a test function.
 *
 * Same as `find`, but limited to elements and with less options, leading to reduced complexity.
 *
 * @category Querying
 * @param test Function to test nodes on.
 * @param nodes Array of nodes to search.
 * @returns All nodes passing `test`.
 */ function findAll(test, nodes) {
    var result = [];
    var nodeStack = [
        Array.isArray(nodes) ? nodes : [
            nodes
        ]
    ];
    var indexStack = [
        0
    ];
    for(;;){
        if (indexStack[0] >= nodeStack[0].length) {
            if (nodeStack.length === 1) {
                return result;
            }
            // Otherwise, remove the current array from the stack.
            nodeStack.shift();
            indexStack.shift();
            continue;
        }
        var elem = nodeStack[0][indexStack[0]++];
        if ((0, domhandler_1.isTag)(elem) && test(elem)) result.push(elem);
        if ((0, domhandler_1.hasChildren)(elem) && elem.children.length > 0) {
            indexStack.unshift(0);
            nodeStack.unshift(elem.children);
        }
    }
}
}),
"[project]/node_modules/domutils/lib/legacy.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.testElement = testElement;
exports.getElements = getElements;
exports.getElementById = getElementById;
exports.getElementsByTagName = getElementsByTagName;
exports.getElementsByClassName = getElementsByClassName;
exports.getElementsByTagType = getElementsByTagType;
var domhandler_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
var querying_js_1 = __turbopack_context__.r("[project]/node_modules/domutils/lib/querying.js [app-route] (ecmascript)");
/**
 * A map of functions to check nodes against.
 */ var Checks = {
    tag_name: function(name) {
        if (typeof name === "function") {
            return function(elem) {
                return (0, domhandler_1.isTag)(elem) && name(elem.name);
            };
        } else if (name === "*") {
            return domhandler_1.isTag;
        }
        return function(elem) {
            return (0, domhandler_1.isTag)(elem) && elem.name === name;
        };
    },
    tag_type: function(type) {
        if (typeof type === "function") {
            return function(elem) {
                return type(elem.type);
            };
        }
        return function(elem) {
            return elem.type === type;
        };
    },
    tag_contains: function(data) {
        if (typeof data === "function") {
            return function(elem) {
                return (0, domhandler_1.isText)(elem) && data(elem.data);
            };
        }
        return function(elem) {
            return (0, domhandler_1.isText)(elem) && elem.data === data;
        };
    }
};
/**
 * Returns a function to check whether a node has an attribute with a particular
 * value.
 *
 * @param attrib Attribute to check.
 * @param value Attribute value to look for.
 * @returns A function to check whether the a node has an attribute with a
 *   particular value.
 */ function getAttribCheck(attrib, value) {
    if (typeof value === "function") {
        return function(elem) {
            return (0, domhandler_1.isTag)(elem) && value(elem.attribs[attrib]);
        };
    }
    return function(elem) {
        return (0, domhandler_1.isTag)(elem) && elem.attribs[attrib] === value;
    };
}
/**
 * Returns a function that returns `true` if either of the input functions
 * returns `true` for a node.
 *
 * @param a First function to combine.
 * @param b Second function to combine.
 * @returns A function taking a node and returning `true` if either of the input
 *   functions returns `true` for the node.
 */ function combineFuncs(a, b) {
    return function(elem) {
        return a(elem) || b(elem);
    };
}
/**
 * Returns a function that executes all checks in `options` and returns `true`
 * if any of them match a node.
 *
 * @param options An object describing nodes to look for.
 * @returns A function that executes all checks in `options` and returns `true`
 *   if any of them match a node.
 */ function compileTest(options) {
    var funcs = Object.keys(options).map(function(key) {
        var value = options[key];
        return Object.prototype.hasOwnProperty.call(Checks, key) ? Checks[key](value) : getAttribCheck(key, value);
    });
    return funcs.length === 0 ? null : funcs.reduce(combineFuncs);
}
/**
 * Checks whether a node matches the description in `options`.
 *
 * @category Legacy Query Functions
 * @param options An object describing nodes to look for.
 * @param node The element to test.
 * @returns Whether the element matches the description in `options`.
 */ function testElement(options, node) {
    var test = compileTest(options);
    return test ? test(node) : true;
}
/**
 * Returns all nodes that match `options`.
 *
 * @category Legacy Query Functions
 * @param options An object describing nodes to look for.
 * @param nodes Nodes to search through.
 * @param recurse Also consider child nodes.
 * @param limit Maximum number of nodes to return.
 * @returns All nodes that match `options`.
 */ function getElements(options, nodes, recurse, limit) {
    if (limit === void 0) {
        limit = Infinity;
    }
    var test = compileTest(options);
    return test ? (0, querying_js_1.filter)(test, nodes, recurse, limit) : [];
}
/**
 * Returns the node with the supplied ID.
 *
 * @category Legacy Query Functions
 * @param id The unique ID attribute value to look for.
 * @param nodes Nodes to search through.
 * @param recurse Also consider child nodes.
 * @returns The node with the supplied ID.
 */ function getElementById(id, nodes, recurse) {
    if (recurse === void 0) {
        recurse = true;
    }
    if (!Array.isArray(nodes)) nodes = [
        nodes
    ];
    return (0, querying_js_1.findOne)(getAttribCheck("id", id), nodes, recurse);
}
/**
 * Returns all nodes with the supplied `tagName`.
 *
 * @category Legacy Query Functions
 * @param tagName Tag name to search for.
 * @param nodes Nodes to search through.
 * @param recurse Also consider child nodes.
 * @param limit Maximum number of nodes to return.
 * @returns All nodes with the supplied `tagName`.
 */ function getElementsByTagName(tagName, nodes, recurse, limit) {
    if (recurse === void 0) {
        recurse = true;
    }
    if (limit === void 0) {
        limit = Infinity;
    }
    return (0, querying_js_1.filter)(Checks["tag_name"](tagName), nodes, recurse, limit);
}
/**
 * Returns all nodes with the supplied `className`.
 *
 * @category Legacy Query Functions
 * @param className Class name to search for.
 * @param nodes Nodes to search through.
 * @param recurse Also consider child nodes.
 * @param limit Maximum number of nodes to return.
 * @returns All nodes with the supplied `className`.
 */ function getElementsByClassName(className, nodes, recurse, limit) {
    if (recurse === void 0) {
        recurse = true;
    }
    if (limit === void 0) {
        limit = Infinity;
    }
    return (0, querying_js_1.filter)(getAttribCheck("class", className), nodes, recurse, limit);
}
/**
 * Returns all nodes with the supplied `type`.
 *
 * @category Legacy Query Functions
 * @param type Element type to look for.
 * @param nodes Nodes to search through.
 * @param recurse Also consider child nodes.
 * @param limit Maximum number of nodes to return.
 * @returns All nodes with the supplied `type`.
 */ function getElementsByTagType(type, nodes, recurse, limit) {
    if (recurse === void 0) {
        recurse = true;
    }
    if (limit === void 0) {
        limit = Infinity;
    }
    return (0, querying_js_1.filter)(Checks["tag_type"](type), nodes, recurse, limit);
}
}),
"[project]/node_modules/domutils/lib/helpers.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DocumentPosition = void 0;
exports.removeSubsets = removeSubsets;
exports.compareDocumentPosition = compareDocumentPosition;
exports.uniqueSort = uniqueSort;
var domhandler_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
/**
 * Given an array of nodes, remove any member that is contained by another
 * member.
 *
 * @category Helpers
 * @param nodes Nodes to filter.
 * @returns Remaining nodes that aren't contained by other nodes.
 */ function removeSubsets(nodes) {
    var idx = nodes.length;
    /*
     * Check if each node (or one of its ancestors) is already contained in the
     * array.
     */ while(--idx >= 0){
        var node = nodes[idx];
        /*
         * Remove the node if it is not unique.
         * We are going through the array from the end, so we only
         * have to check nodes that preceed the node under consideration in the array.
         */ if (idx > 0 && nodes.lastIndexOf(node, idx - 1) >= 0) {
            nodes.splice(idx, 1);
            continue;
        }
        for(var ancestor = node.parent; ancestor; ancestor = ancestor.parent){
            if (nodes.includes(ancestor)) {
                nodes.splice(idx, 1);
                break;
            }
        }
    }
    return nodes;
}
/**
 * @category Helpers
 * @see {@link http://dom.spec.whatwg.org/#dom-node-comparedocumentposition}
 */ var DocumentPosition;
(function(DocumentPosition) {
    DocumentPosition[DocumentPosition["DISCONNECTED"] = 1] = "DISCONNECTED";
    DocumentPosition[DocumentPosition["PRECEDING"] = 2] = "PRECEDING";
    DocumentPosition[DocumentPosition["FOLLOWING"] = 4] = "FOLLOWING";
    DocumentPosition[DocumentPosition["CONTAINS"] = 8] = "CONTAINS";
    DocumentPosition[DocumentPosition["CONTAINED_BY"] = 16] = "CONTAINED_BY";
})(DocumentPosition || (exports.DocumentPosition = DocumentPosition = {}));
/**
 * Compare the position of one node against another node in any other document,
 * returning a bitmask with the values from {@link DocumentPosition}.
 *
 * Document order:
 * > There is an ordering, document order, defined on all the nodes in the
 * > document corresponding to the order in which the first character of the
 * > XML representation of each node occurs in the XML representation of the
 * > document after expansion of general entities. Thus, the document element
 * > node will be the first node. Element nodes occur before their children.
 * > Thus, document order orders element nodes in order of the occurrence of
 * > their start-tag in the XML (after expansion of entities). The attribute
 * > nodes of an element occur after the element and before its children. The
 * > relative order of attribute nodes is implementation-dependent.
 *
 * Source:
 * http://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-document-order
 *
 * @category Helpers
 * @param nodeA The first node to use in the comparison
 * @param nodeB The second node to use in the comparison
 * @returns A bitmask describing the input nodes' relative position.
 *
 * See http://dom.spec.whatwg.org/#dom-node-comparedocumentposition for
 * a description of these values.
 */ function compareDocumentPosition(nodeA, nodeB) {
    var aParents = [];
    var bParents = [];
    if (nodeA === nodeB) {
        return 0;
    }
    var current = (0, domhandler_1.hasChildren)(nodeA) ? nodeA : nodeA.parent;
    while(current){
        aParents.unshift(current);
        current = current.parent;
    }
    current = (0, domhandler_1.hasChildren)(nodeB) ? nodeB : nodeB.parent;
    while(current){
        bParents.unshift(current);
        current = current.parent;
    }
    var maxIdx = Math.min(aParents.length, bParents.length);
    var idx = 0;
    while(idx < maxIdx && aParents[idx] === bParents[idx]){
        idx++;
    }
    if (idx === 0) {
        return DocumentPosition.DISCONNECTED;
    }
    var sharedParent = aParents[idx - 1];
    var siblings = sharedParent.children;
    var aSibling = aParents[idx];
    var bSibling = bParents[idx];
    if (siblings.indexOf(aSibling) > siblings.indexOf(bSibling)) {
        if (sharedParent === nodeB) {
            return DocumentPosition.FOLLOWING | DocumentPosition.CONTAINED_BY;
        }
        return DocumentPosition.FOLLOWING;
    }
    if (sharedParent === nodeA) {
        return DocumentPosition.PRECEDING | DocumentPosition.CONTAINS;
    }
    return DocumentPosition.PRECEDING;
}
/**
 * Sort an array of nodes based on their relative position in the document,
 * removing any duplicate nodes. If the array contains nodes that do not belong
 * to the same document, sort order is unspecified.
 *
 * @category Helpers
 * @param nodes Array of DOM nodes.
 * @returns Collection of unique nodes, sorted in document order.
 */ function uniqueSort(nodes) {
    nodes = nodes.filter(function(node, i, arr) {
        return !arr.includes(node, i + 1);
    });
    nodes.sort(function(a, b) {
        var relative = compareDocumentPosition(a, b);
        if (relative & DocumentPosition.PRECEDING) {
            return -1;
        } else if (relative & DocumentPosition.FOLLOWING) {
            return 1;
        }
        return 0;
    });
    return nodes;
}
}),
"[project]/node_modules/domutils/lib/feeds.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getFeed = getFeed;
var stringify_js_1 = __turbopack_context__.r("[project]/node_modules/domutils/lib/stringify.js [app-route] (ecmascript)");
var legacy_js_1 = __turbopack_context__.r("[project]/node_modules/domutils/lib/legacy.js [app-route] (ecmascript)");
/**
 * Get the feed object from the root of a DOM tree.
 *
 * @category Feeds
 * @param doc - The DOM to to extract the feed from.
 * @returns The feed.
 */ function getFeed(doc) {
    var feedRoot = getOneElement(isValidFeed, doc);
    return !feedRoot ? null : feedRoot.name === "feed" ? getAtomFeed(feedRoot) : getRssFeed(feedRoot);
}
/**
 * Parse an Atom feed.
 *
 * @param feedRoot The root of the feed.
 * @returns The parsed feed.
 */ function getAtomFeed(feedRoot) {
    var _a;
    var childs = feedRoot.children;
    var feed = {
        type: "atom",
        items: (0, legacy_js_1.getElementsByTagName)("entry", childs).map(function(item) {
            var _a;
            var children = item.children;
            var entry = {
                media: getMediaElements(children)
            };
            addConditionally(entry, "id", "id", children);
            addConditionally(entry, "title", "title", children);
            var href = (_a = getOneElement("link", children)) === null || _a === void 0 ? void 0 : _a.attribs["href"];
            if (href) {
                entry.link = href;
            }
            var description = fetch("summary", children) || fetch("content", children);
            if (description) {
                entry.description = description;
            }
            var pubDate = fetch("updated", children);
            if (pubDate) {
                entry.pubDate = new Date(pubDate);
            }
            return entry;
        })
    };
    addConditionally(feed, "id", "id", childs);
    addConditionally(feed, "title", "title", childs);
    var href = (_a = getOneElement("link", childs)) === null || _a === void 0 ? void 0 : _a.attribs["href"];
    if (href) {
        feed.link = href;
    }
    addConditionally(feed, "description", "subtitle", childs);
    var updated = fetch("updated", childs);
    if (updated) {
        feed.updated = new Date(updated);
    }
    addConditionally(feed, "author", "email", childs, true);
    return feed;
}
/**
 * Parse a RSS feed.
 *
 * @param feedRoot The root of the feed.
 * @returns The parsed feed.
 */ function getRssFeed(feedRoot) {
    var _a, _b;
    var childs = (_b = (_a = getOneElement("channel", feedRoot.children)) === null || _a === void 0 ? void 0 : _a.children) !== null && _b !== void 0 ? _b : [];
    var feed = {
        type: feedRoot.name.substr(0, 3),
        id: "",
        items: (0, legacy_js_1.getElementsByTagName)("item", feedRoot.children).map(function(item) {
            var children = item.children;
            var entry = {
                media: getMediaElements(children)
            };
            addConditionally(entry, "id", "guid", children);
            addConditionally(entry, "title", "title", children);
            addConditionally(entry, "link", "link", children);
            addConditionally(entry, "description", "description", children);
            var pubDate = fetch("pubDate", children) || fetch("dc:date", children);
            if (pubDate) entry.pubDate = new Date(pubDate);
            return entry;
        })
    };
    addConditionally(feed, "title", "title", childs);
    addConditionally(feed, "link", "link", childs);
    addConditionally(feed, "description", "description", childs);
    var updated = fetch("lastBuildDate", childs);
    if (updated) {
        feed.updated = new Date(updated);
    }
    addConditionally(feed, "author", "managingEditor", childs, true);
    return feed;
}
var MEDIA_KEYS_STRING = [
    "url",
    "type",
    "lang"
];
var MEDIA_KEYS_INT = [
    "fileSize",
    "bitrate",
    "framerate",
    "samplingrate",
    "channels",
    "duration",
    "height",
    "width"
];
/**
 * Get all media elements of a feed item.
 *
 * @param where Nodes to search in.
 * @returns Media elements.
 */ function getMediaElements(where) {
    return (0, legacy_js_1.getElementsByTagName)("media:content", where).map(function(elem) {
        var attribs = elem.attribs;
        var media = {
            medium: attribs["medium"],
            isDefault: !!attribs["isDefault"]
        };
        for(var _i = 0, MEDIA_KEYS_STRING_1 = MEDIA_KEYS_STRING; _i < MEDIA_KEYS_STRING_1.length; _i++){
            var attrib = MEDIA_KEYS_STRING_1[_i];
            if (attribs[attrib]) {
                media[attrib] = attribs[attrib];
            }
        }
        for(var _a = 0, MEDIA_KEYS_INT_1 = MEDIA_KEYS_INT; _a < MEDIA_KEYS_INT_1.length; _a++){
            var attrib = MEDIA_KEYS_INT_1[_a];
            if (attribs[attrib]) {
                media[attrib] = parseInt(attribs[attrib], 10);
            }
        }
        if (attribs["expression"]) {
            media.expression = attribs["expression"];
        }
        return media;
    });
}
/**
 * Get one element by tag name.
 *
 * @param tagName Tag name to look for
 * @param node Node to search in
 * @returns The element or null
 */ function getOneElement(tagName, node) {
    return (0, legacy_js_1.getElementsByTagName)(tagName, node, true, 1)[0];
}
/**
 * Get the text content of an element with a certain tag name.
 *
 * @param tagName Tag name to look for.
 * @param where Node to search in.
 * @param recurse Whether to recurse into child nodes.
 * @returns The text content of the element.
 */ function fetch(tagName, where, recurse) {
    if (recurse === void 0) {
        recurse = false;
    }
    return (0, stringify_js_1.textContent)((0, legacy_js_1.getElementsByTagName)(tagName, where, recurse, 1)).trim();
}
/**
 * Adds a property to an object if it has a value.
 *
 * @param obj Object to be extended
 * @param prop Property name
 * @param tagName Tag name that contains the conditionally added property
 * @param where Element to search for the property
 * @param recurse Whether to recurse into child nodes.
 */ function addConditionally(obj, prop, tagName, where, recurse) {
    if (recurse === void 0) {
        recurse = false;
    }
    var val = fetch(tagName, where, recurse);
    if (val) obj[prop] = val;
}
/**
 * Checks if an element is a feed root node.
 *
 * @param value The name of the element to check.
 * @returns Whether an element is a feed root node.
 */ function isValidFeed(value) {
    return value === "rss" || value === "feed" || value === "rdf:RDF";
}
}),
"[project]/node_modules/domutils/lib/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __exportStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__exportStar || function(m, exports1) {
    for(var p in m)if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports1, p)) __createBinding(exports1, m, p);
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.hasChildren = exports.isDocument = exports.isComment = exports.isText = exports.isCDATA = exports.isTag = void 0;
__exportStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/stringify.js [app-route] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/traversal.js [app-route] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/manipulation.js [app-route] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/querying.js [app-route] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/legacy.js [app-route] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/helpers.js [app-route] (ecmascript)"), exports);
__exportStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/feeds.js [app-route] (ecmascript)"), exports);
/** @deprecated Use these methods from `domhandler` directly. */ var domhandler_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
Object.defineProperty(exports, "isTag", {
    enumerable: true,
    get: function() {
        return domhandler_1.isTag;
    }
});
Object.defineProperty(exports, "isCDATA", {
    enumerable: true,
    get: function() {
        return domhandler_1.isCDATA;
    }
});
Object.defineProperty(exports, "isText", {
    enumerable: true,
    get: function() {
        return domhandler_1.isText;
    }
});
Object.defineProperty(exports, "isComment", {
    enumerable: true,
    get: function() {
        return domhandler_1.isComment;
    }
});
Object.defineProperty(exports, "isDocument", {
    enumerable: true,
    get: function() {
        return domhandler_1.isDocument;
    }
});
Object.defineProperty(exports, "hasChildren", {
    enumerable: true,
    get: function() {
        return domhandler_1.hasChildren;
    }
});
}),
"[project]/node_modules/htmlparser2/dist/commonjs/Tokenizer.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.QuoteType = void 0;
const decode_1 = __turbopack_context__.r("[project]/node_modules/htmlparser2/node_modules/entities/dist/commonjs/decode.js [app-route] (ecmascript)");
var CharCodes;
(function(CharCodes) {
    CharCodes[CharCodes["Tab"] = 9] = "Tab";
    CharCodes[CharCodes["NewLine"] = 10] = "NewLine";
    CharCodes[CharCodes["FormFeed"] = 12] = "FormFeed";
    CharCodes[CharCodes["CarriageReturn"] = 13] = "CarriageReturn";
    CharCodes[CharCodes["Space"] = 32] = "Space";
    CharCodes[CharCodes["ExclamationMark"] = 33] = "ExclamationMark";
    CharCodes[CharCodes["Number"] = 35] = "Number";
    CharCodes[CharCodes["Amp"] = 38] = "Amp";
    CharCodes[CharCodes["SingleQuote"] = 39] = "SingleQuote";
    CharCodes[CharCodes["DoubleQuote"] = 34] = "DoubleQuote";
    CharCodes[CharCodes["Dash"] = 45] = "Dash";
    CharCodes[CharCodes["Slash"] = 47] = "Slash";
    CharCodes[CharCodes["Zero"] = 48] = "Zero";
    CharCodes[CharCodes["Nine"] = 57] = "Nine";
    CharCodes[CharCodes["Semi"] = 59] = "Semi";
    CharCodes[CharCodes["Lt"] = 60] = "Lt";
    CharCodes[CharCodes["Eq"] = 61] = "Eq";
    CharCodes[CharCodes["Gt"] = 62] = "Gt";
    CharCodes[CharCodes["Questionmark"] = 63] = "Questionmark";
    CharCodes[CharCodes["UpperA"] = 65] = "UpperA";
    CharCodes[CharCodes["LowerA"] = 97] = "LowerA";
    CharCodes[CharCodes["UpperF"] = 70] = "UpperF";
    CharCodes[CharCodes["LowerF"] = 102] = "LowerF";
    CharCodes[CharCodes["UpperZ"] = 90] = "UpperZ";
    CharCodes[CharCodes["LowerZ"] = 122] = "LowerZ";
    CharCodes[CharCodes["LowerX"] = 120] = "LowerX";
    CharCodes[CharCodes["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
})(CharCodes || (CharCodes = {}));
/** All the states the tokenizer can be in. */ var State;
(function(State) {
    State[State["Text"] = 1] = "Text";
    State[State["BeforeTagName"] = 2] = "BeforeTagName";
    State[State["InTagName"] = 3] = "InTagName";
    State[State["InSelfClosingTag"] = 4] = "InSelfClosingTag";
    State[State["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
    State[State["InClosingTagName"] = 6] = "InClosingTagName";
    State[State["AfterClosingTagName"] = 7] = "AfterClosingTagName";
    // Attributes
    State[State["BeforeAttributeName"] = 8] = "BeforeAttributeName";
    State[State["InAttributeName"] = 9] = "InAttributeName";
    State[State["AfterAttributeName"] = 10] = "AfterAttributeName";
    State[State["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
    State[State["InAttributeValueDq"] = 12] = "InAttributeValueDq";
    State[State["InAttributeValueSq"] = 13] = "InAttributeValueSq";
    State[State["InAttributeValueNq"] = 14] = "InAttributeValueNq";
    // Declarations
    State[State["BeforeDeclaration"] = 15] = "BeforeDeclaration";
    State[State["InDeclaration"] = 16] = "InDeclaration";
    // Processing instructions
    State[State["InProcessingInstruction"] = 17] = "InProcessingInstruction";
    // Comments & CDATA
    State[State["BeforeComment"] = 18] = "BeforeComment";
    State[State["CDATASequence"] = 19] = "CDATASequence";
    State[State["InSpecialComment"] = 20] = "InSpecialComment";
    State[State["InCommentLike"] = 21] = "InCommentLike";
    // Special tags
    State[State["BeforeSpecialS"] = 22] = "BeforeSpecialS";
    State[State["BeforeSpecialT"] = 23] = "BeforeSpecialT";
    State[State["SpecialStartSequence"] = 24] = "SpecialStartSequence";
    State[State["InSpecialTag"] = 25] = "InSpecialTag";
    State[State["InEntity"] = 26] = "InEntity";
})(State || (State = {}));
function isWhitespace(c) {
    return c === CharCodes.Space || c === CharCodes.NewLine || c === CharCodes.Tab || c === CharCodes.FormFeed || c === CharCodes.CarriageReturn;
}
function isEndOfTagSection(c) {
    return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c);
}
function isASCIIAlpha(c) {
    return c >= CharCodes.LowerA && c <= CharCodes.LowerZ || c >= CharCodes.UpperA && c <= CharCodes.UpperZ;
}
var QuoteType;
(function(QuoteType) {
    QuoteType[QuoteType["NoValue"] = 0] = "NoValue";
    QuoteType[QuoteType["Unquoted"] = 1] = "Unquoted";
    QuoteType[QuoteType["Single"] = 2] = "Single";
    QuoteType[QuoteType["Double"] = 3] = "Double";
})(QuoteType || (exports.QuoteType = QuoteType = {}));
/**
 * Sequences used to match longer strings.
 *
 * We don't have `Script`, `Style`, or `Title` here. Instead, we re-use the *End
 * sequences with an increased offset.
 */ const Sequences = {
    Cdata: new Uint8Array([
        0x43,
        0x44,
        0x41,
        0x54,
        0x41,
        0x5b
    ]),
    CdataEnd: new Uint8Array([
        0x5d,
        0x5d,
        0x3e
    ]),
    CommentEnd: new Uint8Array([
        0x2d,
        0x2d,
        0x3e
    ]),
    ScriptEnd: new Uint8Array([
        0x3c,
        0x2f,
        0x73,
        0x63,
        0x72,
        0x69,
        0x70,
        0x74
    ]),
    StyleEnd: new Uint8Array([
        0x3c,
        0x2f,
        0x73,
        0x74,
        0x79,
        0x6c,
        0x65
    ]),
    TitleEnd: new Uint8Array([
        0x3c,
        0x2f,
        0x74,
        0x69,
        0x74,
        0x6c,
        0x65
    ]),
    TextareaEnd: new Uint8Array([
        0x3c,
        0x2f,
        0x74,
        0x65,
        0x78,
        0x74,
        0x61,
        0x72,
        0x65,
        0x61
    ]),
    XmpEnd: new Uint8Array([
        0x3c,
        0x2f,
        0x78,
        0x6d,
        0x70
    ])
};
class Tokenizer {
    constructor({ xmlMode = false, decodeEntities = true }, cbs){
        this.cbs = cbs;
        /** The current state the tokenizer is in. */ this.state = State.Text;
        /** The read buffer. */ this.buffer = "";
        /** The beginning of the section that is currently being read. */ this.sectionStart = 0;
        /** The index within the buffer that we are currently looking at. */ this.index = 0;
        /** The start of the last entity. */ this.entityStart = 0;
        /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */ this.baseState = State.Text;
        /** For special parsing behavior inside of script and style tags. */ this.isSpecial = false;
        /** Indicates whether the tokenizer has been paused. */ this.running = true;
        /** The offset of the current buffer. */ this.offset = 0;
        this.currentSequence = undefined;
        this.sequenceIndex = 0;
        this.xmlMode = xmlMode;
        this.decodeEntities = decodeEntities;
        this.entityDecoder = new decode_1.EntityDecoder(xmlMode ? decode_1.xmlDecodeTree : decode_1.htmlDecodeTree, (cp, consumed)=>this.emitCodePoint(cp, consumed));
    }
    reset() {
        this.state = State.Text;
        this.buffer = "";
        this.sectionStart = 0;
        this.index = 0;
        this.baseState = State.Text;
        this.currentSequence = undefined;
        this.running = true;
        this.offset = 0;
    }
    write(chunk) {
        this.offset += this.buffer.length;
        this.buffer = chunk;
        this.parse();
    }
    end() {
        if (this.running) this.finish();
    }
    pause() {
        this.running = false;
    }
    resume() {
        this.running = true;
        if (this.index < this.buffer.length + this.offset) {
            this.parse();
        }
    }
    stateText(c) {
        if (c === CharCodes.Lt || !this.decodeEntities && this.fastForwardTo(CharCodes.Lt)) {
            if (this.index > this.sectionStart) {
                this.cbs.ontext(this.sectionStart, this.index);
            }
            this.state = State.BeforeTagName;
            this.sectionStart = this.index;
        } else if (this.decodeEntities && c === CharCodes.Amp) {
            this.startEntity();
        }
    }
    stateSpecialStartSequence(c) {
        const isEnd = this.sequenceIndex === this.currentSequence.length;
        const isMatch = isEnd ? isEndOfTagSection(c) : (c | 0x20) === this.currentSequence[this.sequenceIndex];
        if (!isMatch) {
            this.isSpecial = false;
        } else if (!isEnd) {
            this.sequenceIndex++;
            return;
        }
        this.sequenceIndex = 0;
        this.state = State.InTagName;
        this.stateInTagName(c);
    }
    /** Look for an end tag. For <title> tags, also decode entities. */ stateInSpecialTag(c) {
        if (this.sequenceIndex === this.currentSequence.length) {
            if (c === CharCodes.Gt || isWhitespace(c)) {
                const endOfText = this.index - this.currentSequence.length;
                if (this.sectionStart < endOfText) {
                    // Spoof the index so that reported locations match up.
                    const actualIndex = this.index;
                    this.index = endOfText;
                    this.cbs.ontext(this.sectionStart, endOfText);
                    this.index = actualIndex;
                }
                this.isSpecial = false;
                this.sectionStart = endOfText + 2; // Skip over the `</`
                this.stateInClosingTagName(c);
                return; // We are done; skip the rest of the function.
            }
            this.sequenceIndex = 0;
        }
        if ((c | 0x20) === this.currentSequence[this.sequenceIndex]) {
            this.sequenceIndex += 1;
        } else if (this.sequenceIndex === 0) {
            if (this.currentSequence === Sequences.TitleEnd) {
                // We have to parse entities in <title> tags.
                if (this.decodeEntities && c === CharCodes.Amp) {
                    this.startEntity();
                }
            } else if (this.fastForwardTo(CharCodes.Lt)) {
                // Outside of <title> tags, we can fast-forward.
                this.sequenceIndex = 1;
            }
        } else {
            // If we see a `<`, set the sequence index to 1; useful for eg. `<</script>`.
            this.sequenceIndex = Number(c === CharCodes.Lt);
        }
    }
    stateCDATASequence(c) {
        if (c === Sequences.Cdata[this.sequenceIndex]) {
            if (++this.sequenceIndex === Sequences.Cdata.length) {
                this.state = State.InCommentLike;
                this.currentSequence = Sequences.CdataEnd;
                this.sequenceIndex = 0;
                this.sectionStart = this.index + 1;
            }
        } else {
            this.sequenceIndex = 0;
            this.state = State.InDeclaration;
            this.stateInDeclaration(c); // Reconsume the character
        }
    }
    /**
     * When we wait for one specific character, we can speed things up
     * by skipping through the buffer until we find it.
     *
     * @returns Whether the character was found.
     */ fastForwardTo(c) {
        while(++this.index < this.buffer.length + this.offset){
            if (this.buffer.charCodeAt(this.index - this.offset) === c) {
                return true;
            }
        }
        /*
         * We increment the index at the end of the `parse` loop,
         * so set it to `buffer.length - 1` here.
         *
         * TODO: Refactor `parse` to increment index before calling states.
         */ this.index = this.buffer.length + this.offset - 1;
        return false;
    }
    /**
     * Comments and CDATA end with `-->` and `]]>`.
     *
     * Their common qualities are:
     * - Their end sequences have a distinct character they start with.
     * - That character is then repeated, so we have to check multiple repeats.
     * - All characters but the start character of the sequence can be skipped.
     */ stateInCommentLike(c) {
        if (c === this.currentSequence[this.sequenceIndex]) {
            if (++this.sequenceIndex === this.currentSequence.length) {
                if (this.currentSequence === Sequences.CdataEnd) {
                    this.cbs.oncdata(this.sectionStart, this.index, 2);
                } else {
                    this.cbs.oncomment(this.sectionStart, this.index, 2);
                }
                this.sequenceIndex = 0;
                this.sectionStart = this.index + 1;
                this.state = State.Text;
            }
        } else if (this.sequenceIndex === 0) {
            // Fast-forward to the first character of the sequence
            if (this.fastForwardTo(this.currentSequence[0])) {
                this.sequenceIndex = 1;
            }
        } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
            // Allow long sequences, eg. --->, ]]]>
            this.sequenceIndex = 0;
        }
    }
    /**
     * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
     *
     * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
     * We allow anything that wouldn't end the tag.
     */ isTagStartChar(c) {
        return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
    }
    startSpecial(sequence, offset) {
        this.isSpecial = true;
        this.currentSequence = sequence;
        this.sequenceIndex = offset;
        this.state = State.SpecialStartSequence;
    }
    stateBeforeTagName(c) {
        if (c === CharCodes.ExclamationMark) {
            this.state = State.BeforeDeclaration;
            this.sectionStart = this.index + 1;
        } else if (c === CharCodes.Questionmark) {
            this.state = State.InProcessingInstruction;
            this.sectionStart = this.index + 1;
        } else if (this.isTagStartChar(c)) {
            const lower = c | 0x20;
            this.sectionStart = this.index;
            if (this.xmlMode) {
                this.state = State.InTagName;
            } else if (lower === Sequences.ScriptEnd[2]) {
                this.state = State.BeforeSpecialS;
            } else if (lower === Sequences.TitleEnd[2] || lower === Sequences.XmpEnd[2]) {
                this.state = State.BeforeSpecialT;
            } else {
                this.state = State.InTagName;
            }
        } else if (c === CharCodes.Slash) {
            this.state = State.BeforeClosingTagName;
        } else {
            this.state = State.Text;
            this.stateText(c);
        }
    }
    stateInTagName(c) {
        if (isEndOfTagSection(c)) {
            this.cbs.onopentagname(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        }
    }
    stateBeforeClosingTagName(c) {
        if (isWhitespace(c)) {
        // Ignore
        } else if (c === CharCodes.Gt) {
            this.state = State.Text;
        } else {
            this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InSpecialComment;
            this.sectionStart = this.index;
        }
    }
    stateInClosingTagName(c) {
        if (c === CharCodes.Gt || isWhitespace(c)) {
            this.cbs.onclosetag(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.state = State.AfterClosingTagName;
            this.stateAfterClosingTagName(c);
        }
    }
    stateAfterClosingTagName(c) {
        // Skip everything until ">"
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateBeforeAttributeName(c) {
        if (c === CharCodes.Gt) {
            this.cbs.onopentagend(this.index);
            if (this.isSpecial) {
                this.state = State.InSpecialTag;
                this.sequenceIndex = 0;
            } else {
                this.state = State.Text;
            }
            this.sectionStart = this.index + 1;
        } else if (c === CharCodes.Slash) {
            this.state = State.InSelfClosingTag;
        } else if (!isWhitespace(c)) {
            this.state = State.InAttributeName;
            this.sectionStart = this.index;
        }
    }
    stateInSelfClosingTag(c) {
        if (c === CharCodes.Gt) {
            this.cbs.onselfclosingtag(this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
            this.isSpecial = false; // Reset special state, in case of self-closing special tags
        } else if (!isWhitespace(c)) {
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        }
    }
    stateInAttributeName(c) {
        if (c === CharCodes.Eq || isEndOfTagSection(c)) {
            this.cbs.onattribname(this.sectionStart, this.index);
            this.sectionStart = this.index;
            this.state = State.AfterAttributeName;
            this.stateAfterAttributeName(c);
        }
    }
    stateAfterAttributeName(c) {
        if (c === CharCodes.Eq) {
            this.state = State.BeforeAttributeValue;
        } else if (c === CharCodes.Slash || c === CharCodes.Gt) {
            this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
            this.sectionStart = -1;
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        } else if (!isWhitespace(c)) {
            this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
            this.state = State.InAttributeName;
            this.sectionStart = this.index;
        }
    }
    stateBeforeAttributeValue(c) {
        if (c === CharCodes.DoubleQuote) {
            this.state = State.InAttributeValueDq;
            this.sectionStart = this.index + 1;
        } else if (c === CharCodes.SingleQuote) {
            this.state = State.InAttributeValueSq;
            this.sectionStart = this.index + 1;
        } else if (!isWhitespace(c)) {
            this.sectionStart = this.index;
            this.state = State.InAttributeValueNq;
            this.stateInAttributeValueNoQuotes(c); // Reconsume token
        }
    }
    handleInAttributeValue(c, quote) {
        if (c === quote || !this.decodeEntities && this.fastForwardTo(quote)) {
            this.cbs.onattribdata(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.cbs.onattribend(quote === CharCodes.DoubleQuote ? QuoteType.Double : QuoteType.Single, this.index + 1);
            this.state = State.BeforeAttributeName;
        } else if (this.decodeEntities && c === CharCodes.Amp) {
            this.startEntity();
        }
    }
    stateInAttributeValueDoubleQuotes(c) {
        this.handleInAttributeValue(c, CharCodes.DoubleQuote);
    }
    stateInAttributeValueSingleQuotes(c) {
        this.handleInAttributeValue(c, CharCodes.SingleQuote);
    }
    stateInAttributeValueNoQuotes(c) {
        if (isWhitespace(c) || c === CharCodes.Gt) {
            this.cbs.onattribdata(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.cbs.onattribend(QuoteType.Unquoted, this.index);
            this.state = State.BeforeAttributeName;
            this.stateBeforeAttributeName(c);
        } else if (this.decodeEntities && c === CharCodes.Amp) {
            this.startEntity();
        }
    }
    stateBeforeDeclaration(c) {
        if (c === CharCodes.OpeningSquareBracket) {
            this.state = State.CDATASequence;
            this.sequenceIndex = 0;
        } else {
            this.state = c === CharCodes.Dash ? State.BeforeComment : State.InDeclaration;
        }
    }
    stateInDeclaration(c) {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.ondeclaration(this.sectionStart, this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateInProcessingInstruction(c) {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.onprocessinginstruction(this.sectionStart, this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateBeforeComment(c) {
        if (c === CharCodes.Dash) {
            this.state = State.InCommentLike;
            this.currentSequence = Sequences.CommentEnd;
            // Allow short comments (eg. <!-->)
            this.sequenceIndex = 2;
            this.sectionStart = this.index + 1;
        } else {
            this.state = State.InDeclaration;
        }
    }
    stateInSpecialComment(c) {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.oncomment(this.sectionStart, this.index, 0);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateBeforeSpecialS(c) {
        const lower = c | 0x20;
        if (lower === Sequences.ScriptEnd[3]) {
            this.startSpecial(Sequences.ScriptEnd, 4);
        } else if (lower === Sequences.StyleEnd[3]) {
            this.startSpecial(Sequences.StyleEnd, 4);
        } else {
            this.state = State.InTagName;
            this.stateInTagName(c); // Consume the token again
        }
    }
    stateBeforeSpecialT(c) {
        const lower = c | 0x20;
        switch(lower){
            case Sequences.TitleEnd[3]:
                {
                    this.startSpecial(Sequences.TitleEnd, 4);
                    break;
                }
            case Sequences.TextareaEnd[3]:
                {
                    this.startSpecial(Sequences.TextareaEnd, 4);
                    break;
                }
            case Sequences.XmpEnd[3]:
                {
                    this.startSpecial(Sequences.XmpEnd, 4);
                    break;
                }
            default:
                {
                    this.state = State.InTagName;
                    this.stateInTagName(c); // Consume the token again
                }
        }
    }
    startEntity() {
        this.baseState = this.state;
        this.state = State.InEntity;
        this.entityStart = this.index;
        this.entityDecoder.startEntity(this.xmlMode ? decode_1.DecodingMode.Strict : this.baseState === State.Text || this.baseState === State.InSpecialTag ? decode_1.DecodingMode.Legacy : decode_1.DecodingMode.Attribute);
    }
    stateInEntity() {
        const indexInBuffer = this.index - this.offset;
        const length = this.entityDecoder.write(this.buffer, indexInBuffer);
        // If `length` is positive, we are done with the entity.
        if (length >= 0) {
            this.state = this.baseState;
            if (length === 0) {
                this.index -= 1;
            }
        } else {
            if (indexInBuffer < this.buffer.length && this.buffer.charCodeAt(indexInBuffer) === CharCodes.Amp) {
                this.state = this.baseState;
                this.index -= 1;
                return;
            }
            // Mark buffer as consumed.
            this.index = this.offset + this.buffer.length - 1;
        }
    }
    /**
     * Remove data that has already been consumed from the buffer.
     */ cleanup() {
        // If we are inside of text or attributes, emit what we already have.
        if (this.running && this.sectionStart !== this.index) {
            if (this.state === State.Text || this.state === State.InSpecialTag && this.sequenceIndex === 0) {
                this.cbs.ontext(this.sectionStart, this.index);
                this.sectionStart = this.index;
            } else if (this.state === State.InAttributeValueDq || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueNq) {
                this.cbs.onattribdata(this.sectionStart, this.index);
                this.sectionStart = this.index;
            }
        }
    }
    shouldContinue() {
        return this.index < this.buffer.length + this.offset && this.running;
    }
    /**
     * Iterates through the buffer, calling the function corresponding to the current state.
     *
     * States that are more likely to be hit are higher up, as a performance improvement.
     */ parse() {
        while(this.shouldContinue()){
            const c = this.buffer.charCodeAt(this.index - this.offset);
            switch(this.state){
                case State.Text:
                    {
                        this.stateText(c);
                        break;
                    }
                case State.SpecialStartSequence:
                    {
                        this.stateSpecialStartSequence(c);
                        break;
                    }
                case State.InSpecialTag:
                    {
                        this.stateInSpecialTag(c);
                        break;
                    }
                case State.CDATASequence:
                    {
                        this.stateCDATASequence(c);
                        break;
                    }
                case State.InAttributeValueDq:
                    {
                        this.stateInAttributeValueDoubleQuotes(c);
                        break;
                    }
                case State.InAttributeName:
                    {
                        this.stateInAttributeName(c);
                        break;
                    }
                case State.InCommentLike:
                    {
                        this.stateInCommentLike(c);
                        break;
                    }
                case State.InSpecialComment:
                    {
                        this.stateInSpecialComment(c);
                        break;
                    }
                case State.BeforeAttributeName:
                    {
                        this.stateBeforeAttributeName(c);
                        break;
                    }
                case State.InTagName:
                    {
                        this.stateInTagName(c);
                        break;
                    }
                case State.InClosingTagName:
                    {
                        this.stateInClosingTagName(c);
                        break;
                    }
                case State.BeforeTagName:
                    {
                        this.stateBeforeTagName(c);
                        break;
                    }
                case State.AfterAttributeName:
                    {
                        this.stateAfterAttributeName(c);
                        break;
                    }
                case State.InAttributeValueSq:
                    {
                        this.stateInAttributeValueSingleQuotes(c);
                        break;
                    }
                case State.BeforeAttributeValue:
                    {
                        this.stateBeforeAttributeValue(c);
                        break;
                    }
                case State.BeforeClosingTagName:
                    {
                        this.stateBeforeClosingTagName(c);
                        break;
                    }
                case State.AfterClosingTagName:
                    {
                        this.stateAfterClosingTagName(c);
                        break;
                    }
                case State.BeforeSpecialS:
                    {
                        this.stateBeforeSpecialS(c);
                        break;
                    }
                case State.BeforeSpecialT:
                    {
                        this.stateBeforeSpecialT(c);
                        break;
                    }
                case State.InAttributeValueNq:
                    {
                        this.stateInAttributeValueNoQuotes(c);
                        break;
                    }
                case State.InSelfClosingTag:
                    {
                        this.stateInSelfClosingTag(c);
                        break;
                    }
                case State.InDeclaration:
                    {
                        this.stateInDeclaration(c);
                        break;
                    }
                case State.BeforeDeclaration:
                    {
                        this.stateBeforeDeclaration(c);
                        break;
                    }
                case State.BeforeComment:
                    {
                        this.stateBeforeComment(c);
                        break;
                    }
                case State.InProcessingInstruction:
                    {
                        this.stateInProcessingInstruction(c);
                        break;
                    }
                case State.InEntity:
                    {
                        this.stateInEntity();
                        break;
                    }
            }
            this.index++;
        }
        this.cleanup();
    }
    finish() {
        if (this.state === State.InEntity) {
            this.entityDecoder.end();
            this.state = this.baseState;
        }
        this.handleTrailingData();
        this.cbs.onend();
    }
    /** Handle any trailing data. */ handleTrailingData() {
        const endIndex = this.buffer.length + this.offset;
        // If there is no remaining data, we are done.
        if (this.sectionStart >= endIndex) {
            return;
        }
        if (this.state === State.InCommentLike) {
            if (this.currentSequence === Sequences.CdataEnd) {
                this.cbs.oncdata(this.sectionStart, endIndex, 0);
            } else {
                this.cbs.oncomment(this.sectionStart, endIndex, 0);
            }
        } else if (this.state === State.InTagName || this.state === State.BeforeAttributeName || this.state === State.BeforeAttributeValue || this.state === State.AfterAttributeName || this.state === State.InAttributeName || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueDq || this.state === State.InAttributeValueNq || this.state === State.InClosingTagName) {
        /*
             * If we are currently in an opening or closing tag, us not calling the
             * respective callback signals that the tag should be ignored.
             */ } else {
            this.cbs.ontext(this.sectionStart, endIndex);
        }
    }
    emitCodePoint(cp, consumed) {
        if (this.baseState !== State.Text && this.baseState !== State.InSpecialTag) {
            if (this.sectionStart < this.entityStart) {
                this.cbs.onattribdata(this.sectionStart, this.entityStart);
            }
            this.sectionStart = this.entityStart + consumed;
            this.index = this.sectionStart - 1;
            this.cbs.onattribentity(cp);
        } else {
            if (this.sectionStart < this.entityStart) {
                this.cbs.ontext(this.sectionStart, this.entityStart);
            }
            this.sectionStart = this.entityStart + consumed;
            this.index = this.sectionStart - 1;
            this.cbs.ontextentity(cp, this.sectionStart);
        }
    }
}
exports.default = Tokenizer;
}),
"[project]/node_modules/htmlparser2/dist/commonjs/Parser.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importStar || function() {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o) {
            var ar = [];
            for(var k in o)if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
            for(var k = ownKeys(mod), i = 0; i < k.length; i++)if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
    };
}();
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Parser = void 0;
const Tokenizer_js_1 = __importStar(__turbopack_context__.r("[project]/node_modules/htmlparser2/dist/commonjs/Tokenizer.js [app-route] (ecmascript)"));
const decode_1 = __turbopack_context__.r("[project]/node_modules/htmlparser2/node_modules/entities/dist/commonjs/decode.js [app-route] (ecmascript)");
const formTags = new Set([
    "input",
    "option",
    "optgroup",
    "select",
    "button",
    "datalist",
    "textarea"
]);
const pTag = new Set([
    "p"
]);
const tableSectionTags = new Set([
    "thead",
    "tbody"
]);
const ddtTags = new Set([
    "dd",
    "dt"
]);
const rtpTags = new Set([
    "rt",
    "rp"
]);
const openImpliesClose = new Map([
    [
        "tr",
        new Set([
            "tr",
            "th",
            "td"
        ])
    ],
    [
        "th",
        new Set([
            "th"
        ])
    ],
    [
        "td",
        new Set([
            "thead",
            "th",
            "td"
        ])
    ],
    [
        "body",
        new Set([
            "head",
            "link",
            "script"
        ])
    ],
    [
        "li",
        new Set([
            "li"
        ])
    ],
    [
        "p",
        pTag
    ],
    [
        "h1",
        pTag
    ],
    [
        "h2",
        pTag
    ],
    [
        "h3",
        pTag
    ],
    [
        "h4",
        pTag
    ],
    [
        "h5",
        pTag
    ],
    [
        "h6",
        pTag
    ],
    [
        "select",
        formTags
    ],
    [
        "input",
        formTags
    ],
    [
        "output",
        formTags
    ],
    [
        "button",
        formTags
    ],
    [
        "datalist",
        formTags
    ],
    [
        "textarea",
        formTags
    ],
    [
        "option",
        new Set([
            "option"
        ])
    ],
    [
        "optgroup",
        new Set([
            "optgroup",
            "option"
        ])
    ],
    [
        "dd",
        ddtTags
    ],
    [
        "dt",
        ddtTags
    ],
    [
        "address",
        pTag
    ],
    [
        "article",
        pTag
    ],
    [
        "aside",
        pTag
    ],
    [
        "blockquote",
        pTag
    ],
    [
        "details",
        pTag
    ],
    [
        "div",
        pTag
    ],
    [
        "dl",
        pTag
    ],
    [
        "fieldset",
        pTag
    ],
    [
        "figcaption",
        pTag
    ],
    [
        "figure",
        pTag
    ],
    [
        "footer",
        pTag
    ],
    [
        "form",
        pTag
    ],
    [
        "header",
        pTag
    ],
    [
        "hr",
        pTag
    ],
    [
        "main",
        pTag
    ],
    [
        "nav",
        pTag
    ],
    [
        "ol",
        pTag
    ],
    [
        "pre",
        pTag
    ],
    [
        "section",
        pTag
    ],
    [
        "table",
        pTag
    ],
    [
        "ul",
        pTag
    ],
    [
        "rt",
        rtpTags
    ],
    [
        "rp",
        rtpTags
    ],
    [
        "tbody",
        tableSectionTags
    ],
    [
        "tfoot",
        tableSectionTags
    ]
]);
const voidElements = new Set([
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "command",
    "embed",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
]);
const foreignContextElements = new Set([
    "math",
    "svg"
]);
const htmlIntegrationElements = new Set([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "annotation-xml",
    "foreignobject",
    "desc",
    "title"
]);
const reNameEnd = /\s|\//;
class Parser {
    constructor(cbs, options = {}){
        var _a, _b, _c, _d, _e, _f;
        this.options = options;
        /** The start index of the last event. */ this.startIndex = 0;
        /** The end index of the last event. */ this.endIndex = 0;
        /**
         * Store the start index of the current open tag,
         * so we can update the start index for attributes.
         */ this.openTagStart = 0;
        this.tagname = "";
        this.attribname = "";
        this.attribvalue = "";
        this.attribs = null;
        this.stack = [];
        this.buffers = [];
        this.bufferOffset = 0;
        /** The index of the last written buffer. Used when resuming after a `pause()`. */ this.writeIndex = 0;
        /** Indicates whether the parser has finished running / `.end` has been called. */ this.ended = false;
        this.cbs = cbs !== null && cbs !== void 0 ? cbs : {};
        this.htmlMode = !this.options.xmlMode;
        this.lowerCaseTagNames = (_a = options.lowerCaseTags) !== null && _a !== void 0 ? _a : this.htmlMode;
        this.lowerCaseAttributeNames = (_b = options.lowerCaseAttributeNames) !== null && _b !== void 0 ? _b : this.htmlMode;
        this.recognizeSelfClosing = (_c = options.recognizeSelfClosing) !== null && _c !== void 0 ? _c : !this.htmlMode;
        this.tokenizer = new ((_d = options.Tokenizer) !== null && _d !== void 0 ? _d : Tokenizer_js_1.default)(this.options, this);
        this.foreignContext = [
            !this.htmlMode
        ];
        (_f = (_e = this.cbs).onparserinit) === null || _f === void 0 ? void 0 : _f.call(_e, this);
    }
    // Tokenizer event handlers
    /** @internal */ ontext(start, endIndex) {
        var _a, _b;
        const data = this.getSlice(start, endIndex);
        this.endIndex = endIndex - 1;
        (_b = (_a = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a, data);
        this.startIndex = endIndex;
    }
    /** @internal */ ontextentity(cp, endIndex) {
        var _a, _b;
        this.endIndex = endIndex - 1;
        (_b = (_a = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a, (0, decode_1.fromCodePoint)(cp));
        this.startIndex = endIndex;
    }
    /**
     * Checks if the current tag is a void element. Override this if you want
     * to specify your own additional void elements.
     */ isVoidElement(name) {
        return this.htmlMode && voidElements.has(name);
    }
    /** @internal */ onopentagname(start, endIndex) {
        this.endIndex = endIndex;
        let name = this.getSlice(start, endIndex);
        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }
        this.emitOpenTag(name);
    }
    emitOpenTag(name) {
        var _a, _b, _c, _d;
        this.openTagStart = this.startIndex;
        this.tagname = name;
        const impliesClose = this.htmlMode && openImpliesClose.get(name);
        if (impliesClose) {
            while(this.stack.length > 0 && impliesClose.has(this.stack[0])){
                const element = this.stack.shift();
                (_b = (_a = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a, element, true);
            }
        }
        if (!this.isVoidElement(name)) {
            this.stack.unshift(name);
            if (this.htmlMode) {
                if (foreignContextElements.has(name)) {
                    this.foreignContext.unshift(true);
                } else if (htmlIntegrationElements.has(name)) {
                    this.foreignContext.unshift(false);
                }
            }
        }
        (_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, name);
        if (this.cbs.onopentag) this.attribs = {};
    }
    endOpenTag(isImplied) {
        var _a, _b;
        this.startIndex = this.openTagStart;
        if (this.attribs) {
            (_b = (_a = this.cbs).onopentag) === null || _b === void 0 ? void 0 : _b.call(_a, this.tagname, this.attribs, isImplied);
            this.attribs = null;
        }
        if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
            this.cbs.onclosetag(this.tagname, true);
        }
        this.tagname = "";
    }
    /** @internal */ onopentagend(endIndex) {
        this.endIndex = endIndex;
        this.endOpenTag(false);
        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }
    /** @internal */ onclosetag(start, endIndex) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.endIndex = endIndex;
        let name = this.getSlice(start, endIndex);
        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }
        if (this.htmlMode && (foreignContextElements.has(name) || htmlIntegrationElements.has(name))) {
            this.foreignContext.shift();
        }
        if (!this.isVoidElement(name)) {
            const pos = this.stack.indexOf(name);
            if (pos !== -1) {
                for(let index = 0; index <= pos; index++){
                    const element = this.stack.shift();
                    // We know the stack has sufficient elements.
                    (_b = (_a = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a, element, index !== pos);
                }
            } else if (this.htmlMode && name === "p") {
                // Implicit open before close
                this.emitOpenTag("p");
                this.closeCurrentTag(true);
            }
        } else if (this.htmlMode && name === "br") {
            // We can't use `emitOpenTag` for implicit open, as `br` would be implicitly closed.
            (_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, "br");
            (_f = (_e = this.cbs).onopentag) === null || _f === void 0 ? void 0 : _f.call(_e, "br", {}, true);
            (_h = (_g = this.cbs).onclosetag) === null || _h === void 0 ? void 0 : _h.call(_g, "br", false);
        }
        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }
    /** @internal */ onselfclosingtag(endIndex) {
        this.endIndex = endIndex;
        if (this.recognizeSelfClosing || this.foreignContext[0]) {
            this.closeCurrentTag(false);
            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        } else {
            // Ignore the fact that the tag is self-closing.
            this.onopentagend(endIndex);
        }
    }
    closeCurrentTag(isOpenImplied) {
        var _a, _b;
        const name = this.tagname;
        this.endOpenTag(isOpenImplied);
        // Self-closing tags will be on the top of the stack
        if (this.stack[0] === name) {
            // If the opening tag isn't implied, the closing tag has to be implied.
            (_b = (_a = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a, name, !isOpenImplied);
            this.stack.shift();
        }
    }
    /** @internal */ onattribname(start, endIndex) {
        this.startIndex = start;
        const name = this.getSlice(start, endIndex);
        this.attribname = this.lowerCaseAttributeNames ? name.toLowerCase() : name;
    }
    /** @internal */ onattribdata(start, endIndex) {
        this.attribvalue += this.getSlice(start, endIndex);
    }
    /** @internal */ onattribentity(cp) {
        this.attribvalue += (0, decode_1.fromCodePoint)(cp);
    }
    /** @internal */ onattribend(quote, endIndex) {
        var _a, _b;
        this.endIndex = endIndex;
        (_b = (_a = this.cbs).onattribute) === null || _b === void 0 ? void 0 : _b.call(_a, this.attribname, this.attribvalue, quote === Tokenizer_js_1.QuoteType.Double ? '"' : quote === Tokenizer_js_1.QuoteType.Single ? "'" : quote === Tokenizer_js_1.QuoteType.NoValue ? undefined : null);
        if (this.attribs && !Object.prototype.hasOwnProperty.call(this.attribs, this.attribname)) {
            this.attribs[this.attribname] = this.attribvalue;
        }
        this.attribvalue = "";
    }
    getInstructionName(value) {
        const index = value.search(reNameEnd);
        let name = index < 0 ? value : value.substr(0, index);
        if (this.lowerCaseTagNames) {
            name = name.toLowerCase();
        }
        return name;
    }
    /** @internal */ ondeclaration(start, endIndex) {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);
        if (this.cbs.onprocessinginstruction) {
            const name = this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
        }
        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }
    /** @internal */ onprocessinginstruction(start, endIndex) {
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex);
        if (this.cbs.onprocessinginstruction) {
            const name = this.getInstructionName(value);
            this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
        }
        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }
    /** @internal */ oncomment(start, endIndex, offset) {
        var _a, _b, _c, _d;
        this.endIndex = endIndex;
        (_b = (_a = this.cbs).oncomment) === null || _b === void 0 ? void 0 : _b.call(_a, this.getSlice(start, endIndex - offset));
        (_d = (_c = this.cbs).oncommentend) === null || _d === void 0 ? void 0 : _d.call(_c);
        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }
    /** @internal */ oncdata(start, endIndex, offset) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        this.endIndex = endIndex;
        const value = this.getSlice(start, endIndex - offset);
        if (!this.htmlMode || this.options.recognizeCDATA) {
            (_b = (_a = this.cbs).oncdatastart) === null || _b === void 0 ? void 0 : _b.call(_a);
            (_d = (_c = this.cbs).ontext) === null || _d === void 0 ? void 0 : _d.call(_c, value);
            (_f = (_e = this.cbs).oncdataend) === null || _f === void 0 ? void 0 : _f.call(_e);
        } else {
            (_h = (_g = this.cbs).oncomment) === null || _h === void 0 ? void 0 : _h.call(_g, `[CDATA[${value}]]`);
            (_k = (_j = this.cbs).oncommentend) === null || _k === void 0 ? void 0 : _k.call(_j);
        }
        // Set `startIndex` for next node
        this.startIndex = endIndex + 1;
    }
    /** @internal */ onend() {
        var _a, _b;
        if (this.cbs.onclosetag) {
            // Set the end index for all remaining tags
            this.endIndex = this.startIndex;
            for(let index = 0; index < this.stack.length; index++){
                this.cbs.onclosetag(this.stack[index], true);
            }
        }
        (_b = (_a = this.cbs).onend) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    /**
     * Resets the parser to a blank state, ready to parse a new HTML document
     */ reset() {
        var _a, _b, _c, _d;
        (_b = (_a = this.cbs).onreset) === null || _b === void 0 ? void 0 : _b.call(_a);
        this.tokenizer.reset();
        this.tagname = "";
        this.attribname = "";
        this.attribs = null;
        this.stack.length = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        (_d = (_c = this.cbs).onparserinit) === null || _d === void 0 ? void 0 : _d.call(_c, this);
        this.buffers.length = 0;
        this.foreignContext.length = 0;
        this.foreignContext.unshift(!this.htmlMode);
        this.bufferOffset = 0;
        this.writeIndex = 0;
        this.ended = false;
    }
    /**
     * Resets the parser, then parses a complete document and
     * pushes it to the handler.
     *
     * @param data Document to parse.
     */ parseComplete(data) {
        this.reset();
        this.end(data);
    }
    getSlice(start, end) {
        while(start - this.bufferOffset >= this.buffers[0].length){
            this.shiftBuffer();
        }
        let slice = this.buffers[0].slice(start - this.bufferOffset, end - this.bufferOffset);
        while(end - this.bufferOffset > this.buffers[0].length){
            this.shiftBuffer();
            slice += this.buffers[0].slice(0, end - this.bufferOffset);
        }
        return slice;
    }
    shiftBuffer() {
        this.bufferOffset += this.buffers[0].length;
        this.writeIndex--;
        this.buffers.shift();
    }
    /**
     * Parses a chunk of data and calls the corresponding callbacks.
     *
     * @param chunk Chunk to parse.
     */ write(chunk) {
        var _a, _b;
        if (this.ended) {
            (_b = (_a = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a, new Error(".write() after done!"));
            return;
        }
        this.buffers.push(chunk);
        if (this.tokenizer.running) {
            this.tokenizer.write(chunk);
            this.writeIndex++;
        }
    }
    /**
     * Parses the end of the buffer and clears the stack, calls onend.
     *
     * @param chunk Optional final chunk to parse.
     */ end(chunk) {
        var _a, _b;
        if (this.ended) {
            (_b = (_a = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a, new Error(".end() after done!"));
            return;
        }
        if (chunk) this.write(chunk);
        this.ended = true;
        this.tokenizer.end();
    }
    /**
     * Pauses parsing. The parser won't emit events until `resume` is called.
     */ pause() {
        this.tokenizer.pause();
    }
    /**
     * Resumes parsing after `pause` was called.
     */ resume() {
        this.tokenizer.resume();
        while(this.tokenizer.running && this.writeIndex < this.buffers.length){
            this.tokenizer.write(this.buffers[this.writeIndex++]);
        }
        if (this.ended) this.tokenizer.end();
    }
    /**
     * Alias of `write`, for backwards compatibility.
     *
     * @param chunk Chunk to parse.
     * @deprecated
     */ parseChunk(chunk) {
        this.write(chunk);
    }
    /**
     * Alias of `end`, for backwards compatibility.
     *
     * @param chunk Optional final chunk to parse.
     * @deprecated
     */ done(chunk) {
        this.end(chunk);
    }
}
exports.Parser = Parser;
}),
"[project]/node_modules/htmlparser2/dist/commonjs/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __createBinding = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__createBinding || (Object.create ? function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
            enumerable: true,
            get: function() {
                return m[k];
            }
        };
    }
    Object.defineProperty(o, k2, desc);
} : function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
});
var __setModuleDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__setModuleDefault || (Object.create ? function(o, v) {
    Object.defineProperty(o, "default", {
        enumerable: true,
        value: v
    });
} : function(o, v) {
    o["default"] = v;
});
var __importStar = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importStar || function() {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o) {
            var ar = [];
            for(var k in o)if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
            for(var k = ownKeys(mod), i = 0; i < k.length; i++)if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
    };
}();
var __importDefault = /*TURBOPACK member replacement*/ __turbopack_context__.e && /*TURBOPACK member replacement*/ __turbopack_context__.e.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : {
        "default": mod
    };
};
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.DomUtils = exports.getFeed = exports.ElementType = exports.QuoteType = exports.Tokenizer = exports.DefaultHandler = exports.DomHandler = exports.Parser = void 0;
exports.parseDocument = parseDocument;
exports.parseDOM = parseDOM;
exports.createDocumentStream = createDocumentStream;
exports.createDomStream = createDomStream;
exports.parseFeed = parseFeed;
const Parser_js_1 = __turbopack_context__.r("[project]/node_modules/htmlparser2/dist/commonjs/Parser.js [app-route] (ecmascript)");
var Parser_js_2 = __turbopack_context__.r("[project]/node_modules/htmlparser2/dist/commonjs/Parser.js [app-route] (ecmascript)");
Object.defineProperty(exports, "Parser", {
    enumerable: true,
    get: function() {
        return Parser_js_2.Parser;
    }
});
const domhandler_1 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
var domhandler_2 = __turbopack_context__.r("[project]/node_modules/domhandler/lib/index.js [app-route] (ecmascript)");
Object.defineProperty(exports, "DomHandler", {
    enumerable: true,
    get: function() {
        return domhandler_2.DomHandler;
    }
});
// Old name for DomHandler
Object.defineProperty(exports, "DefaultHandler", {
    enumerable: true,
    get: function() {
        return domhandler_2.DomHandler;
    }
});
// Helper methods
/**
 * Parses the data, returns the resulting document.
 *
 * @param data The data that should be parsed.
 * @param options Optional options for the parser and DOM handler.
 */ function parseDocument(data, options) {
    const handler = new domhandler_1.DomHandler(undefined, options);
    new Parser_js_1.Parser(handler, options).end(data);
    return handler.root;
}
/**
 * Parses data, returns an array of the root nodes.
 *
 * Note that the root nodes still have a `Document` node as their parent.
 * Use `parseDocument` to get the `Document` node instead.
 *
 * @param data The data that should be parsed.
 * @param options Optional options for the parser and DOM handler.
 * @deprecated Use `parseDocument` instead.
 */ function parseDOM(data, options) {
    return parseDocument(data, options).children;
}
/**
 * Creates a parser instance, with an attached DOM handler.
 *
 * @param callback A callback that will be called once parsing has been completed, with the resulting document.
 * @param options Optional options for the parser and DOM handler.
 * @param elementCallback An optional callback that will be called every time a tag has been completed inside of the DOM.
 */ function createDocumentStream(callback, options, elementCallback) {
    const handler = new domhandler_1.DomHandler((error)=>callback(error, handler.root), options, elementCallback);
    return new Parser_js_1.Parser(handler, options);
}
/**
 * Creates a parser instance, with an attached DOM handler.
 *
 * @param callback A callback that will be called once parsing has been completed, with an array of root nodes.
 * @param options Optional options for the parser and DOM handler.
 * @param elementCallback An optional callback that will be called every time a tag has been completed inside of the DOM.
 * @deprecated Use `createDocumentStream` instead.
 */ function createDomStream(callback, options, elementCallback) {
    const handler = new domhandler_1.DomHandler(callback, options, elementCallback);
    return new Parser_js_1.Parser(handler, options);
}
var Tokenizer_js_1 = __turbopack_context__.r("[project]/node_modules/htmlparser2/dist/commonjs/Tokenizer.js [app-route] (ecmascript)");
Object.defineProperty(exports, "Tokenizer", {
    enumerable: true,
    get: function() {
        return __importDefault(Tokenizer_js_1).default;
    }
});
Object.defineProperty(exports, "QuoteType", {
    enumerable: true,
    get: function() {
        return Tokenizer_js_1.QuoteType;
    }
});
/*
 * All of the following exports exist for backwards-compatibility.
 * They should probably be removed eventually.
 */ exports.ElementType = __importStar(__turbopack_context__.r("[project]/node_modules/domelementtype/lib/index.js [app-route] (ecmascript)"));
const domutils_1 = __turbopack_context__.r("[project]/node_modules/domutils/lib/index.js [app-route] (ecmascript)");
var domutils_2 = __turbopack_context__.r("[project]/node_modules/domutils/lib/index.js [app-route] (ecmascript)");
Object.defineProperty(exports, "getFeed", {
    enumerable: true,
    get: function() {
        return domutils_2.getFeed;
    }
});
const parseFeedDefaultOptions = {
    xmlMode: true
};
/**
 * Parse a feed.
 *
 * @param feed The feed that should be parsed, as a string.
 * @param options Optionally, options for parsing. When using this, you should set `xmlMode` to `true`.
 */ function parseFeed(feed, options = parseFeedDefaultOptions) {
    return (0, domutils_1.getFeed)(parseDOM(feed, options));
}
exports.DomUtils = __importStar(__turbopack_context__.r("[project]/node_modules/domutils/lib/index.js [app-route] (ecmascript)"));
}),
"[project]/node_modules/escape-string-regexp/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = (string)=>{
    if (typeof string !== 'string') {
        throw new TypeError('Expected a string');
    }
    // Escape characters with special meaning either inside or outside character sets.
    // Use a simple backslash escape when it’s always valid, and a \unnnn escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
    return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
};
}),
"[project]/node_modules/is-plain-object/dist/is-plain-object.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, '__esModule', {
    value: true
});
/*!
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */ function isObject(o) {
    return Object.prototype.toString.call(o) === '[object Object]';
}
function isPlainObject(o) {
    var ctor, prot;
    if (isObject(o) === false) return false;
    // If has modified constructor
    ctor = o.constructor;
    if (ctor === undefined) return true;
    // If has modified prototype
    prot = ctor.prototype;
    if (isObject(prot) === false) return false;
    // If constructor does not have an Object-specific method
    if (prot.hasOwnProperty('isPrototypeOf') === false) {
        return false;
    }
    // Most likely a plain Object
    return true;
}
exports.isPlainObject = isPlainObject;
}),
"[project]/node_modules/deepmerge/dist/cjs.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var isMergeableObject = function isMergeableObject(value) {
    return isNonNullObject(value) && !isSpecial(value);
};
function isNonNullObject(value) {
    return !!value && typeof value === 'object';
}
function isSpecial(value) {
    var stringValue = Object.prototype.toString.call(value);
    return stringValue === '[object RegExp]' || stringValue === '[object Date]' || isReactElement(value);
}
// see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;
function isReactElement(value) {
    return value.$$typeof === REACT_ELEMENT_TYPE;
}
function emptyTarget(val) {
    return Array.isArray(val) ? [] : {};
}
function cloneUnlessOtherwiseSpecified(value, options) {
    return options.clone !== false && options.isMergeableObject(value) ? deepmerge(emptyTarget(value), value, options) : value;
}
function defaultArrayMerge(target, source, options) {
    return target.concat(source).map(function(element) {
        return cloneUnlessOtherwiseSpecified(element, options);
    });
}
function getMergeFunction(key, options) {
    if (!options.customMerge) {
        return deepmerge;
    }
    var customMerge = options.customMerge(key);
    return typeof customMerge === 'function' ? customMerge : deepmerge;
}
function getEnumerableOwnPropertySymbols(target) {
    return Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(target).filter(function(symbol) {
        return Object.propertyIsEnumerable.call(target, symbol);
    }) : [];
}
function getKeys(target) {
    return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target));
}
function propertyIsOnObject(object, property) {
    try {
        return property in object;
    } catch (_) {
        return false;
    }
}
// Protects from prototype poisoning and unexpected merging up the prototype chain.
function propertyIsUnsafe(target, key) {
    return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
     && !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
     && Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
    ;
}
function mergeObject(target, source, options) {
    var destination = {};
    if (options.isMergeableObject(target)) {
        getKeys(target).forEach(function(key) {
            destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
        });
    }
    getKeys(source).forEach(function(key) {
        if (propertyIsUnsafe(target, key)) {
            return;
        }
        if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
            destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
        } else {
            destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
        }
    });
    return destination;
}
function deepmerge(target, source, options) {
    options = options || {};
    options.arrayMerge = options.arrayMerge || defaultArrayMerge;
    options.isMergeableObject = options.isMergeableObject || isMergeableObject;
    // cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
    // implementations can use it. The caller may not replace it.
    options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;
    var sourceIsArray = Array.isArray(source);
    var targetIsArray = Array.isArray(target);
    var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;
    if (!sourceAndTargetTypesMatch) {
        return cloneUnlessOtherwiseSpecified(source, options);
    } else if (sourceIsArray) {
        return options.arrayMerge(target, source, options);
    } else {
        return mergeObject(target, source, options);
    }
}
deepmerge.all = function deepmergeAll(array, options) {
    if (!Array.isArray(array)) {
        throw new Error('first argument should be an array');
    }
    return array.reduce(function(prev, next) {
        return deepmerge(prev, next, options);
    }, {});
};
var deepmerge_1 = deepmerge;
module.exports = deepmerge_1;
}),
"[project]/node_modules/parse-srcset/src/parse-srcset.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

/**
 * Srcset Parser
 *
 * By Alex Bell |  MIT License
 *
 * JS Parser for the string value that appears in markup <img srcset="here">
 *
 * @returns Array [{url: _, d: _, w: _, h:_}, ...]
 *
 * Based super duper closely on the reference algorithm at:
 * https://html.spec.whatwg.org/multipage/embedded-content.html#parse-a-srcset-attribute
 *
 * Most comments are copied in directly from the spec
 * (except for comments in parens).
 */ (function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        ((r)=>r !== undefined && __turbopack_context__.v(r))(factory());
    } else if (("TURBOPACK compile-time value", "object") === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.parseSrcset = factory();
    }
})(/*TURBOPACK member replacement*/ __turbopack_context__.e, function() {
    // 1. Let input be the value passed to this algorithm.
    return function(input) {
        // UTILITY FUNCTIONS
        // Manual is faster than RegEx
        // http://bjorn.tipling.com/state-and-regular-expressions-in-javascript
        // http://jsperf.com/whitespace-character/5
        function isSpace(c) {
            return c === "\u0020" || // space
            c === "\u0009" || // horizontal tab
            c === "\u000A" || // new line
            c === "\u000C" || // form feed
            c === "\u000D"; // carriage return
        }
        function collectCharacters(regEx) {
            var chars, match = regEx.exec(input.substring(pos));
            if (match) {
                chars = match[0];
                pos += chars.length;
                return chars;
            }
        }
        var inputLength = input.length, // (Don't use \s, to avoid matching non-breaking space)
        regexLeadingSpaces = /^[ \t\n\r\u000c]+/, regexLeadingCommasOrSpaces = /^[, \t\n\r\u000c]+/, regexLeadingNotSpaces = /^[^ \t\n\r\u000c]+/, regexTrailingCommas = /[,]+$/, regexNonNegativeInteger = /^\d+$/, // ( Positive or negative or unsigned integers or decimals, without or without exponents.
        // Must include at least one digit.
        // According to spec tests any decimal point must be followed by a digit.
        // No leading plus sign is allowed.)
        // https://html.spec.whatwg.org/multipage/infrastructure.html#valid-floating-point-number
        regexFloatingPoint = /^-?(?:[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/, url, descriptors, currentDescriptor, state, c, // 2. Let position be a pointer into input, initially pointing at the start
        //    of the string.
        pos = 0, // 3. Let candidates be an initially empty source set.
        candidates = [];
        // 4. Splitting loop: Collect a sequence of characters that are space
        //    characters or U+002C COMMA characters. If any U+002C COMMA characters
        //    were collected, that is a parse error.
        while(true){
            collectCharacters(regexLeadingCommasOrSpaces);
            // 5. If position is past the end of input, return candidates and abort these steps.
            if (pos >= inputLength) {
                return candidates; // (we're done, this is the sole return path)
            }
            // 6. Collect a sequence of characters that are not space characters,
            //    and let that be url.
            url = collectCharacters(regexLeadingNotSpaces);
            // 7. Let descriptors be a new empty list.
            descriptors = [];
            // 8. If url ends with a U+002C COMMA character (,), follow these substeps:
            //		(1). Remove all trailing U+002C COMMA characters from url. If this removed
            //         more than one character, that is a parse error.
            if (url.slice(-1) === ",") {
                url = url.replace(regexTrailingCommas, "");
                // (Jump ahead to step 9 to skip tokenization and just push the candidate).
                parseDescriptors();
            //	Otherwise, follow these substeps:
            } else {
                tokenize();
            } // (close else of step 8)
        // 16. Return to the step labeled splitting loop.
        } // (Close of big while loop.)
        /**
		 * Tokenizes descriptor properties prior to parsing
		 * Returns undefined.
		 */ function tokenize() {
            // 8.1. Descriptor tokeniser: Skip whitespace
            collectCharacters(regexLeadingSpaces);
            // 8.2. Let current descriptor be the empty string.
            currentDescriptor = "";
            // 8.3. Let state be in descriptor.
            state = "in descriptor";
            while(true){
                // 8.4. Let c be the character at position.
                c = input.charAt(pos);
                //  Do the following depending on the value of state.
                //  For the purpose of this step, "EOF" is a special character representing
                //  that position is past the end of input.
                // In descriptor
                if (state === "in descriptor") {
                    // Do the following, depending on the value of c:
                    // Space character
                    // If current descriptor is not empty, append current descriptor to
                    // descriptors and let current descriptor be the empty string.
                    // Set state to after descriptor.
                    if (isSpace(c)) {
                        if (currentDescriptor) {
                            descriptors.push(currentDescriptor);
                            currentDescriptor = "";
                            state = "after descriptor";
                        }
                    // U+002C COMMA (,)
                    // Advance position to the next character in input. If current descriptor
                    // is not empty, append current descriptor to descriptors. Jump to the step
                    // labeled descriptor parser.
                    } else if (c === ",") {
                        pos += 1;
                        if (currentDescriptor) {
                            descriptors.push(currentDescriptor);
                        }
                        parseDescriptors();
                        return;
                    // U+0028 LEFT PARENTHESIS (()
                    // Append c to current descriptor. Set state to in parens.
                    } else if (c === "\u0028") {
                        currentDescriptor = currentDescriptor + c;
                        state = "in parens";
                    // EOF
                    // If current descriptor is not empty, append current descriptor to
                    // descriptors. Jump to the step labeled descriptor parser.
                    } else if (c === "") {
                        if (currentDescriptor) {
                            descriptors.push(currentDescriptor);
                        }
                        parseDescriptors();
                        return;
                    // Anything else
                    // Append c to current descriptor.
                    } else {
                        currentDescriptor = currentDescriptor + c;
                    }
                // (end "in descriptor"
                // In parens
                } else if (state === "in parens") {
                    // U+0029 RIGHT PARENTHESIS ())
                    // Append c to current descriptor. Set state to in descriptor.
                    if (c === ")") {
                        currentDescriptor = currentDescriptor + c;
                        state = "in descriptor";
                    // EOF
                    // Append current descriptor to descriptors. Jump to the step labeled
                    // descriptor parser.
                    } else if (c === "") {
                        descriptors.push(currentDescriptor);
                        parseDescriptors();
                        return;
                    // Anything else
                    // Append c to current descriptor.
                    } else {
                        currentDescriptor = currentDescriptor + c;
                    }
                // After descriptor
                } else if (state === "after descriptor") {
                    // Do the following, depending on the value of c:
                    // Space character: Stay in this state.
                    if (isSpace(c)) {
                    // EOF: Jump to the step labeled descriptor parser.
                    } else if (c === "") {
                        parseDescriptors();
                        return;
                    // Anything else
                    // Set state to in descriptor. Set position to the previous character in input.
                    } else {
                        state = "in descriptor";
                        pos -= 1;
                    }
                }
                // Advance position to the next character in input.
                pos += 1;
            // Repeat this step.
            } // (close while true loop)
        }
        /**
		 * Adds descriptor properties to a candidate, pushes to the candidates array
		 * @return undefined
		 */ // Declared outside of the while loop so that it's only created once.
        function parseDescriptors() {
            // 9. Descriptor parser: Let error be no.
            var pError = false, // 10. Let width be absent.
            // 11. Let density be absent.
            // 12. Let future-compat-h be absent. (We're implementing it now as h)
            w, d, h, i, candidate = {}, desc, lastChar, value, intVal, floatVal;
            // 13. For each descriptor in descriptors, run the appropriate set of steps
            // from the following list:
            for(i = 0; i < descriptors.length; i++){
                desc = descriptors[i];
                lastChar = desc[desc.length - 1];
                value = desc.substring(0, desc.length - 1);
                intVal = parseInt(value, 10);
                floatVal = parseFloat(value);
                // If the descriptor consists of a valid non-negative integer followed by
                // a U+0077 LATIN SMALL LETTER W character
                if (regexNonNegativeInteger.test(value) && lastChar === "w") {
                    // If width and density are not both absent, then let error be yes.
                    if (w || d) {
                        pError = true;
                    }
                    // Apply the rules for parsing non-negative integers to the descriptor.
                    // If the result is zero, let error be yes.
                    // Otherwise, let width be the result.
                    if (intVal === 0) {
                        pError = true;
                    } else {
                        w = intVal;
                    }
                // If the descriptor consists of a valid floating-point number followed by
                // a U+0078 LATIN SMALL LETTER X character
                } else if (regexFloatingPoint.test(value) && lastChar === "x") {
                    // If width, density and future-compat-h are not all absent, then let error
                    // be yes.
                    if (w || d || h) {
                        pError = true;
                    }
                    // Apply the rules for parsing floating-point number values to the descriptor.
                    // If the result is less than zero, let error be yes. Otherwise, let density
                    // be the result.
                    if (floatVal < 0) {
                        pError = true;
                    } else {
                        d = floatVal;
                    }
                // If the descriptor consists of a valid non-negative integer followed by
                // a U+0068 LATIN SMALL LETTER H character
                } else if (regexNonNegativeInteger.test(value) && lastChar === "h") {
                    // If height and density are not both absent, then let error be yes.
                    if (h || d) {
                        pError = true;
                    }
                    // Apply the rules for parsing non-negative integers to the descriptor.
                    // If the result is zero, let error be yes. Otherwise, let future-compat-h
                    // be the result.
                    if (intVal === 0) {
                        pError = true;
                    } else {
                        h = intVal;
                    }
                // Anything else, Let error be yes.
                } else {
                    pError = true;
                }
            } // (close step 13 for loop)
            // 15. If error is still no, then append a new image source to candidates whose
            // URL is url, associated with a width width if not absent and a pixel
            // density density if not absent. Otherwise, there is a parse error.
            if (!pError) {
                candidate.url = url;
                if (w) {
                    candidate.w = w;
                }
                if (d) {
                    candidate.d = d;
                }
                if (h) {
                    candidate.h = h;
                }
                candidates.push(candidate);
            } else if (console && console.log) {
                console.log("Invalid srcset descriptor found in '" + input + "' at '" + desc + "'.");
            }
        } // (close parseDescriptors fn)
    };
});
}),
"[externals]/postcss [external] (postcss, cjs, [project]/node_modules/postcss)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("postcss-9745a0d11e3197ae", () => require("postcss-9745a0d11e3197ae"));

module.exports = mod;
}),
"[project]/node_modules/sanitize-html/index.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

const htmlparser = __turbopack_context__.r("[project]/node_modules/htmlparser2/dist/commonjs/index.js [app-route] (ecmascript)");
const escapeStringRegexp = __turbopack_context__.r("[project]/node_modules/escape-string-regexp/index.js [app-route] (ecmascript)");
const { isPlainObject } = __turbopack_context__.r("[project]/node_modules/is-plain-object/dist/is-plain-object.js [app-route] (ecmascript)");
const deepmerge = __turbopack_context__.r("[project]/node_modules/deepmerge/dist/cjs.js [app-route] (ecmascript)");
const parseSrcset = __turbopack_context__.r("[project]/node_modules/parse-srcset/src/parse-srcset.js [app-route] (ecmascript)");
const { parse: postcssParse } = __turbopack_context__.r("[externals]/postcss [external] (postcss, cjs, [project]/node_modules/postcss)");
// Tags that can conceivably represent stand-alone media.
const mediaTags = [
    'img',
    'audio',
    'video',
    'picture',
    'svg',
    'object',
    'map',
    'iframe',
    'embed'
];
// Tags that are inherently vulnerable to being used in XSS attacks.
const vulnerableTags = [
    'script',
    'style'
];
function each(obj, cb) {
    if (obj) {
        Object.keys(obj).forEach(function(key) {
            cb(obj[key], key);
        });
    }
}
// Avoid false positives with .__proto__, .hasOwnProperty, etc.
function has(obj, key) {
    return ({}).hasOwnProperty.call(obj, key);
}
// Returns those elements of `a` for which `cb(a)` returns truthy
function filter(a, cb) {
    const n = [];
    each(a, function(v) {
        if (cb(v)) {
            n.push(v);
        }
    });
    return n;
}
function isEmptyObject(obj) {
    for(const key in obj){
        if (has(obj, key)) {
            return false;
        }
    }
    return true;
}
function stringifySrcset(parsedSrcset) {
    return parsedSrcset.map(function(part) {
        if (!part.url) {
            throw new Error('URL missing');
        }
        return part.url + (part.w ? ` ${part.w}w` : '') + (part.h ? ` ${part.h}h` : '') + (part.d ? ` ${part.d}x` : '');
    }).join(', ');
}
module.exports = sanitizeHtml;
// A valid attribute name.
// We use a tolerant definition based on the set of strings defined by
// html.spec.whatwg.org/multipage/parsing.html#before-attribute-name-state
// and html.spec.whatwg.org/multipage/parsing.html#attribute-name-state .
// The characters accepted are ones which can be appended to the attribute
// name buffer without triggering a parse error:
//   * unexpected-equals-sign-before-attribute-name
//   * unexpected-null-character
//   * unexpected-character-in-attribute-name
// We exclude the empty string because it's impossible to get to the after
// attribute name state with an empty attribute name buffer.
const VALID_HTML_ATTRIBUTE_NAME = /^[^\0\t\n\f\r /<=>]+$/;
// Ignore the _recursing flag; it's there for recursive
// invocation as a guard against this exploit:
// https://github.com/fb55/htmlparser2/issues/105
function sanitizeHtml(html, options, _recursing) {
    if (html == null) {
        return '';
    }
    if (typeof html === 'number') {
        html = html.toString();
    }
    let result = '';
    // Used for hot swapping the result variable with an empty string
    // in order to "capture" the text written to it.
    let tempResult = '';
    function Frame(tag, attribs) {
        const that = this;
        this.tag = tag;
        this.attribs = attribs || {};
        this.tagPosition = result.length;
        this.text = ''; // Node inner text
        this.openingTagLength = 0;
        this.mediaChildren = [];
        this.updateParentNodeText = function() {
            if (stack.length) {
                const parentFrame = stack[stack.length - 1];
                parentFrame.text += that.text;
            }
        };
        this.updateParentNodeMediaChildren = function() {
            if (stack.length && mediaTags.includes(this.tag)) {
                const parentFrame = stack[stack.length - 1];
                parentFrame.mediaChildren.push(this.tag);
            }
        };
    }
    options = Object.assign({}, sanitizeHtml.defaults, options);
    options.parser = Object.assign({}, htmlParserDefaults, options.parser);
    const tagAllowed = function(name) {
        return options.allowedTags === false || (options.allowedTags || []).indexOf(name) > -1;
    };
    // vulnerableTags
    vulnerableTags.forEach(function(tag) {
        if (tagAllowed(tag) && !options.allowVulnerableTags) {
            console.warn(`\n\n⚠️ Your \`allowedTags\` option includes, \`${tag}\`, which is inherently\nvulnerable to XSS attacks. Please remove it from \`allowedTags\`.\nOr, to disable this warning, add the \`allowVulnerableTags\` option\nand ensure you are accounting for this risk.\n\n`);
        }
    });
    // Tags that contain something other than HTML, or where discarding
    // the text when the tag is disallowed makes sense for other reasons.
    // If we are not allowing these tags, we should drop their content too.
    // For other tags you would drop the tag but keep its content.
    const nonTextTagsArray = options.nonTextTags || [
        'script',
        'style',
        'textarea',
        'option'
    ];
    let allowedAttributesMap;
    let allowedAttributesGlobMap;
    if (options.allowedAttributes) {
        allowedAttributesMap = {};
        allowedAttributesGlobMap = {};
        each(options.allowedAttributes, function(attributes, tag) {
            allowedAttributesMap[tag] = [];
            const globRegex = [];
            attributes.forEach(function(obj) {
                if (typeof obj === 'string' && obj.indexOf('*') >= 0) {
                    globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, '.*'));
                } else {
                    allowedAttributesMap[tag].push(obj);
                }
            });
            if (globRegex.length) {
                allowedAttributesGlobMap[tag] = new RegExp('^(' + globRegex.join('|') + ')$');
            }
        });
    }
    const allowedClassesMap = {};
    const allowedClassesGlobMap = {};
    const allowedClassesRegexMap = {};
    each(options.allowedClasses, function(classes, tag) {
        // Implicitly allows the class attribute
        if (allowedAttributesMap) {
            if (!has(allowedAttributesMap, tag)) {
                allowedAttributesMap[tag] = [];
            }
            allowedAttributesMap[tag].push('class');
        }
        allowedClassesMap[tag] = classes;
        if (Array.isArray(classes)) {
            const globRegex = [];
            allowedClassesMap[tag] = [];
            allowedClassesRegexMap[tag] = [];
            classes.forEach(function(obj) {
                if (typeof obj === 'string' && obj.indexOf('*') >= 0) {
                    globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, '.*'));
                } else if (obj instanceof RegExp) {
                    allowedClassesRegexMap[tag].push(obj);
                } else {
                    allowedClassesMap[tag].push(obj);
                }
            });
            if (globRegex.length) {
                allowedClassesGlobMap[tag] = new RegExp('^(' + globRegex.join('|') + ')$');
            }
        }
    });
    const transformTagsMap = {};
    let transformTagsAll;
    each(options.transformTags, function(transform, tag) {
        let transFun;
        if (typeof transform === 'function') {
            transFun = transform;
        } else if (typeof transform === 'string') {
            transFun = sanitizeHtml.simpleTransform(transform);
        }
        if (tag === '*') {
            transformTagsAll = transFun;
        } else {
            transformTagsMap[tag] = transFun;
        }
    });
    let depth;
    let stack;
    let skipMap;
    let transformMap;
    let skipText;
    let skipTextDepth;
    let addedText = false;
    initializeState();
    const parser = new htmlparser.Parser({
        onopentag: function(name, attribs) {
            if (options.onOpenTag) {
                options.onOpenTag(name, attribs);
            }
            // If `enforceHtmlBoundary` is `true` and this has found the opening
            // `html` tag, reset the state.
            if (options.enforceHtmlBoundary && name === 'html') {
                initializeState();
            }
            if (skipText) {
                skipTextDepth++;
                return;
            }
            const frame = new Frame(name, attribs);
            stack.push(frame);
            let skip = false;
            const hasText = !!frame.text;
            let transformedTag;
            if (has(transformTagsMap, name)) {
                transformedTag = transformTagsMap[name](name, attribs);
                frame.attribs = attribs = transformedTag.attribs;
                if (transformedTag.text !== undefined) {
                    frame.innerText = transformedTag.text;
                }
                if (name !== transformedTag.tagName) {
                    frame.name = name = transformedTag.tagName;
                    transformMap[depth] = transformedTag.tagName;
                }
            }
            if (transformTagsAll) {
                transformedTag = transformTagsAll(name, attribs);
                frame.attribs = attribs = transformedTag.attribs;
                if (name !== transformedTag.tagName) {
                    frame.name = name = transformedTag.tagName;
                    transformMap[depth] = transformedTag.tagName;
                }
            }
            if (!tagAllowed(name) || options.disallowedTagsMode === 'recursiveEscape' && !isEmptyObject(skipMap) || options.nestingLimit != null && depth >= options.nestingLimit) {
                skip = true;
                skipMap[depth] = true;
                if (options.disallowedTagsMode === 'discard' || options.disallowedTagsMode === 'completelyDiscard') {
                    if (nonTextTagsArray.indexOf(name) !== -1) {
                        skipText = true;
                        skipTextDepth = 1;
                    }
                }
            }
            depth++;
            if (skip) {
                if (options.disallowedTagsMode === 'discard' || options.disallowedTagsMode === 'completelyDiscard') {
                    // We want the contents but not this tag
                    if (frame.innerText && !hasText) {
                        const escaped = escapeHtml(frame.innerText);
                        if (options.textFilter) {
                            result += options.textFilter(escaped, name);
                        } else {
                            result += escaped;
                        }
                        addedText = true;
                    }
                    return;
                }
                tempResult = result;
                result = '';
            }
            result += '<' + name;
            if (name === 'script') {
                if (options.allowedScriptHostnames || options.allowedScriptDomains) {
                    frame.innerText = '';
                }
            }
            const isBeingEscaped = skip && (options.disallowedTagsMode === 'escape' || options.disallowedTagsMode === 'recursiveEscape');
            const shouldPreserveEscapedAttributes = isBeingEscaped && options.preserveEscapedAttributes;
            if (shouldPreserveEscapedAttributes) {
                each(attribs, function(value, a) {
                    result += ' ' + a + '="' + escapeHtml(value || '', true) + '"';
                });
            } else if (!allowedAttributesMap || has(allowedAttributesMap, name) || allowedAttributesMap['*']) {
                each(attribs, function(value, a) {
                    if (!VALID_HTML_ATTRIBUTE_NAME.test(a)) {
                        // This prevents part of an attribute name in the output from being
                        // interpreted as the end of an attribute, or end of a tag.
                        delete frame.attribs[a];
                        return;
                    }
                    // If the value is empty, check if the attribute is
                    // in the allowedEmptyAttributes array.
                    // If it is not in the allowedEmptyAttributes array,
                    // and it is a known non-boolean attribute, delete it
                    // List taken from https://html.spec.whatwg.org/multipage/indices.html#attributes-3
                    if (value === '' && !options.allowedEmptyAttributes.includes(a) && (options.nonBooleanAttributes.includes(a) || options.nonBooleanAttributes.includes('*'))) {
                        delete frame.attribs[a];
                        return;
                    }
                    // check allowedAttributesMap for the element and attribute and modify the value
                    // as necessary if there are specific values defined.
                    let passedAllowedAttributesMapCheck = false;
                    if (!allowedAttributesMap || has(allowedAttributesMap, name) && allowedAttributesMap[name].indexOf(a) !== -1 || allowedAttributesMap['*'] && allowedAttributesMap['*'].indexOf(a) !== -1 || has(allowedAttributesGlobMap, name) && allowedAttributesGlobMap[name].test(a) || allowedAttributesGlobMap['*'] && allowedAttributesGlobMap['*'].test(a)) {
                        passedAllowedAttributesMapCheck = true;
                    } else if (allowedAttributesMap && allowedAttributesMap[name]) {
                        for (const o of allowedAttributesMap[name]){
                            if (isPlainObject(o) && o.name && o.name === a) {
                                passedAllowedAttributesMapCheck = true;
                                let newValue = '';
                                if (o.multiple === true) {
                                    // verify the values that are allowed
                                    const splitStrArray = value.split(' ');
                                    for (const s of splitStrArray){
                                        if (o.values.indexOf(s) !== -1) {
                                            if (newValue === '') {
                                                newValue = s;
                                            } else {
                                                newValue += ' ' + s;
                                            }
                                        }
                                    }
                                } else if (o.values.indexOf(value) >= 0) {
                                    // verified an allowed value matches the entire attribute value
                                    newValue = value;
                                }
                                value = newValue;
                            }
                        }
                    }
                    if (passedAllowedAttributesMapCheck) {
                        if (options.allowedSchemesAppliedToAttributes.indexOf(a) !== -1) {
                            if (naughtyHref(name, value)) {
                                delete frame.attribs[a];
                                return;
                            }
                        }
                        if (name === 'script' && a === 'src') {
                            let allowed = true;
                            try {
                                const parsed = parseUrl(value);
                                if (options.allowedScriptHostnames || options.allowedScriptDomains) {
                                    const allowedHostname = (options.allowedScriptHostnames || []).find(function(hostname) {
                                        return hostname === parsed.url.hostname;
                                    });
                                    const allowedDomain = (options.allowedScriptDomains || []).find(function(domain) {
                                        return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                                    });
                                    allowed = allowedHostname || allowedDomain;
                                }
                            } catch (e) {
                                allowed = false;
                            }
                            if (!allowed) {
                                delete frame.attribs[a];
                                return;
                            }
                        }
                        if (name === 'iframe' && a === 'src') {
                            let allowed = true;
                            try {
                                const parsed = parseUrl(value);
                                if (parsed.isRelativeUrl) {
                                    // default value of allowIframeRelativeUrls is true
                                    // unless allowedIframeHostnames or allowedIframeDomains specified
                                    allowed = has(options, 'allowIframeRelativeUrls') ? options.allowIframeRelativeUrls : !options.allowedIframeHostnames && !options.allowedIframeDomains;
                                } else if (options.allowedIframeHostnames || options.allowedIframeDomains) {
                                    const allowedHostname = (options.allowedIframeHostnames || []).find(function(hostname) {
                                        return hostname === parsed.url.hostname;
                                    });
                                    const allowedDomain = (options.allowedIframeDomains || []).find(function(domain) {
                                        return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                                    });
                                    allowed = allowedHostname || allowedDomain;
                                }
                            } catch (e) {
                                // Unparseable iframe src
                                allowed = false;
                            }
                            if (!allowed) {
                                delete frame.attribs[a];
                                return;
                            }
                        }
                        if (a === 'srcset') {
                            try {
                                let parsed = parseSrcset(value);
                                parsed.forEach(function(value) {
                                    if (naughtyHref('srcset', value.url)) {
                                        value.evil = true;
                                    }
                                });
                                parsed = filter(parsed, function(v) {
                                    return !v.evil;
                                });
                                if (!parsed.length) {
                                    delete frame.attribs[a];
                                    return;
                                } else {
                                    value = stringifySrcset(filter(parsed, function(v) {
                                        return !v.evil;
                                    }));
                                    frame.attribs[a] = value;
                                }
                            } catch (e) {
                                // Unparseable srcset
                                delete frame.attribs[a];
                                return;
                            }
                        }
                        if (a === 'class') {
                            const allowedSpecificClasses = allowedClassesMap[name];
                            const allowedWildcardClasses = allowedClassesMap['*'];
                            const allowedSpecificClassesGlob = allowedClassesGlobMap[name];
                            const allowedSpecificClassesRegex = allowedClassesRegexMap[name];
                            const allowedWildcardClassesRegex = allowedClassesRegexMap['*'];
                            const allowedWildcardClassesGlob = allowedClassesGlobMap['*'];
                            const allowedClassesGlobs = [
                                allowedSpecificClassesGlob,
                                allowedWildcardClassesGlob
                            ].concat(allowedSpecificClassesRegex, allowedWildcardClassesRegex).filter(function(t) {
                                return t;
                            });
                            if (allowedSpecificClasses && allowedWildcardClasses) {
                                value = filterClasses(value, deepmerge(allowedSpecificClasses, allowedWildcardClasses), allowedClassesGlobs);
                            } else {
                                value = filterClasses(value, allowedSpecificClasses || allowedWildcardClasses, allowedClassesGlobs);
                            }
                            if (!value.length) {
                                delete frame.attribs[a];
                                return;
                            }
                        }
                        if (a === 'style') {
                            if (options.parseStyleAttributes) {
                                try {
                                    const abstractSyntaxTree = postcssParse(name + ' {' + value + '}', {
                                        map: false
                                    });
                                    const filteredAST = filterCss(abstractSyntaxTree, options.allowedStyles);
                                    value = stringifyStyleAttributes(filteredAST);
                                    if (value.length === 0) {
                                        delete frame.attribs[a];
                                        return;
                                    }
                                } catch (e) {
                                    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
                                    ;
                                    delete frame.attribs[a];
                                    return;
                                }
                            } else if (options.allowedStyles) {
                                throw new Error('allowedStyles option cannot be used together with parseStyleAttributes: false.');
                            }
                        }
                        result += ' ' + a;
                        if (value && value.length) {
                            result += '="' + escapeHtml(value, true) + '"';
                        } else if (options.allowedEmptyAttributes.includes(a)) {
                            result += '=""';
                        }
                    } else {
                        delete frame.attribs[a];
                    }
                });
            }
            if (options.selfClosing.indexOf(name) !== -1) {
                result += ' />';
            } else {
                result += '>';
                if (frame.innerText && !hasText && !options.textFilter) {
                    result += escapeHtml(frame.innerText);
                    addedText = true;
                }
            }
            if (skip) {
                result = tempResult + escapeHtml(result);
                tempResult = '';
            }
            frame.openingTagLength = result.length - frame.tagPosition;
        },
        ontext: function(text) {
            if (skipText) {
                return;
            }
            const lastFrame = stack[stack.length - 1];
            let tag;
            if (lastFrame) {
                tag = lastFrame.tag;
                // If inner text was set by transform function then let's use it
                text = lastFrame.innerText !== undefined ? lastFrame.innerText : text;
            }
            if (options.disallowedTagsMode === 'completelyDiscard' && !tagAllowed(tag)) {
                text = '';
            } else if ((options.disallowedTagsMode === 'discard' || options.disallowedTagsMode === 'completelyDiscard') && (tag === 'script' || tag === 'style')) {
                // htmlparser2 gives us these as-is. Escaping them ruins the content. Allowing
                // script tags is, by definition, game over for XSS protection, so if that's
                // your concern, don't allow them. The same is essentially true for style tags
                // which have their own collection of XSS vectors.
                result += text;
            } else if ((options.disallowedTagsMode === 'discard' || options.disallowedTagsMode === 'completelyDiscard') && (tag === 'textarea' || tag === 'xmp')) {
                // htmlparser2 treats <textarea> and <xmp> as raw text elements and
                // does NOT decode entities inside them. The text is already properly
                // encoded, so pass it through without additional escaping to avoid
                // double-encoding. Other "nonTextTags" like <option> are not raw text
                // elements in htmlparser2, so their contents are decoded and must be
                // escaped below like any other text (important to prevent XSS via
                // entity-encoded payloads such as <option>&lt;script&gt;...&lt;/script&gt;</option>).
                result += text;
            } else if (!addedText) {
                const escaped = escapeHtml(text, false);
                if (options.textFilter) {
                    result += options.textFilter(escaped, tag);
                } else {
                    result += escaped;
                }
            }
            if (stack.length) {
                const frame = stack[stack.length - 1];
                frame.text += text;
            }
        },
        onclosetag: function(name, isImplied) {
            if (options.onCloseTag) {
                options.onCloseTag(name, isImplied);
            }
            if (skipText) {
                skipTextDepth--;
                if (!skipTextDepth) {
                    skipText = false;
                } else {
                    return;
                }
            }
            const frame = stack.pop();
            if (!frame) {
                // Do not crash on bad markup
                return;
            }
            if (frame.tag !== name) {
                // Another case of bad markup.
                // Push to stack, so that it will be used in future closing tags.
                stack.push(frame);
                return;
            }
            skipText = options.enforceHtmlBoundary ? name === 'html' : false;
            depth--;
            const skip = skipMap[depth];
            if (skip) {
                delete skipMap[depth];
                if (options.disallowedTagsMode === 'discard' || options.disallowedTagsMode === 'completelyDiscard') {
                    frame.updateParentNodeText();
                    return;
                }
                tempResult = result;
                result = '';
            }
            if (transformMap[depth]) {
                name = transformMap[depth];
                delete transformMap[depth];
            }
            if (options.exclusiveFilter) {
                const filterResult = options.exclusiveFilter(frame);
                if (filterResult === 'excludeTag') {
                    if (skip) {
                        // no longer escaping the tag since it's not added at all
                        result = tempResult;
                        tempResult = '';
                    }
                    // remove the opening tag from the result
                    result = result.substring(0, frame.tagPosition) + result.substring(frame.tagPosition + frame.openingTagLength);
                    return;
                } else if (filterResult) {
                    result = result.substring(0, frame.tagPosition);
                    return;
                }
            }
            frame.updateParentNodeMediaChildren();
            frame.updateParentNodeText();
            if (// Already output />
            options.selfClosing.indexOf(name) !== -1 || isImplied && !tagAllowed(name) && [
                'escape',
                'recursiveEscape'
            ].indexOf(options.disallowedTagsMode) >= 0) {
                if (skip) {
                    result = tempResult;
                    tempResult = '';
                }
                return;
            }
            result += '</' + name + '>';
            if (skip) {
                result = tempResult + escapeHtml(result);
                tempResult = '';
            }
            addedText = false;
        }
    }, options.parser);
    parser.write(html);
    parser.end();
    if (options.disallowedTagsMode === 'escape' || options.disallowedTagsMode === 'recursiveEscape') {
        const lastParsedIndex = parser.endIndex;
        if (lastParsedIndex != null && lastParsedIndex >= 0 && lastParsedIndex < html.length) {
            const unparsed = html.substring(lastParsedIndex);
            result += escapeHtml(unparsed);
        } else if ((lastParsedIndex == null || lastParsedIndex < 0) && html.length > 0 && result === '') {
            result = escapeHtml(html);
        }
    }
    return result;
    //TURBOPACK unreachable
    ;
    function initializeState() {
        result = '';
        depth = 0;
        stack = [];
        skipMap = {};
        transformMap = {};
        skipText = false;
        skipTextDepth = 0;
    }
    function escapeHtml(s, quote) {
        if (typeof s !== 'string') {
            s = s + '';
        }
        if (options.parser.decodeEntities) {
            s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (quote) {
                s = s.replace(/"/g, '&quot;');
            }
        }
        // TODO: this is inadequate because it will pass `&0;`. This approach
        // will not work, each & must be considered with regard to whether it
        // is followed by a 100% syntactically valid entity or not, and escaped
        // if it is not. If this bothers you, don't set parser.decodeEntities
        // to false. (The default is true.)
        s = s.replace(/&(?![a-zA-Z0-9#]{1,20};)/g, '&amp;') // Match ampersands not part of existing HTML entity
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (quote) {
            s = s.replace(/"/g, '&quot;');
        }
        return s;
    }
    function naughtyHref(name, href) {
        // Browsers ignore character codes of 32 (space) and below in a surprising
        // number of situations. Start reading here:
        // https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet#Embedded_tab
        // eslint-disable-next-line no-control-regex
        href = href.replace(/[\x00-\x20]+/g, '');
        // Clobber any comments in URLs, which the browser might
        // interpret inside an XML data island, allowing
        // a javascript: URL to be snuck through
        while(true){
            const firstIndex = href.indexOf('<!--');
            if (firstIndex === -1) {
                break;
            }
            const lastIndex = href.indexOf('-->', firstIndex + 4);
            if (lastIndex === -1) {
                break;
            }
            href = href.substring(0, firstIndex) + href.substring(lastIndex + 3);
        }
        // Case insensitive so we don't get faked out by JAVASCRIPT #1
        // Allow more characters after the first so we don't get faked
        // out by certain schemes browsers accept
        const matches = href.match(/^([a-zA-Z][a-zA-Z0-9.\-+]*):/);
        if (!matches) {
            // Protocol-relative URL starting with any combination of '/' and '\'
            if (href.match(/^[/\\]{2}/)) {
                return !options.allowProtocolRelative;
            }
            // No scheme
            return false;
        }
        const scheme = matches[1].toLowerCase();
        if (has(options.allowedSchemesByTag, name)) {
            return options.allowedSchemesByTag[name].indexOf(scheme) === -1;
        }
        return !options.allowedSchemes || options.allowedSchemes.indexOf(scheme) === -1;
    }
    function parseUrl(value) {
        value = value.replace(/^(\w+:)?\s*[\\/]\s*[\\/]/, '$1//');
        if (value.startsWith('relative:')) {
            // An attempt to exploit our workaround for base URLs being
            // mandatory for relative URL validation in the WHATWG
            // URL parser, reject it
            throw new Error('relative: exploit attempt');
        }
        // naughtyHref is in charge of whether protocol relative URLs
        // are cool. Here we are concerned just with allowed hostnames and
        // whether to allow relative URLs.
        //
        // Build a placeholder "base URL" against which any reasonable
        // relative URL may be parsed successfully
        let base = 'relative://relative-site';
        for(let i = 0; i < 100; i++){
            base += `/${i}`;
        }
        const parsed = new URL(value, base);
        const isRelativeUrl = parsed && parsed.hostname === 'relative-site' && parsed.protocol === 'relative:';
        return {
            isRelativeUrl,
            url: parsed
        };
    }
    /**
   * Filters user input css properties by allowlisted regex attributes.
   * Modifies the abstractSyntaxTree object.
   *
   * @param {object} abstractSyntaxTree  - Object representation of CSS attributes.
   * @property {array[Declaration]} abstractSyntaxTree.nodes[0] -
   * Each object contains prop and value key, i.e { prop: 'color', value: 'red' }.
   * @param {object} allowedStyles       - Keys are properties (i.e color),
   * value is list of permitted regex rules (i.e /green/i).
   * @return {object}                    - The modified tree.
   */ function filterCss(abstractSyntaxTree, allowedStyles) {
        if (!allowedStyles) {
            return abstractSyntaxTree;
        }
        const astRules = abstractSyntaxTree.nodes[0];
        let selectedRule;
        // Merge global and tag-specific styles into new AST.
        if (allowedStyles[astRules.selector] && allowedStyles['*']) {
            selectedRule = deepmerge(allowedStyles[astRules.selector], allowedStyles['*']);
        } else {
            selectedRule = allowedStyles[astRules.selector] || allowedStyles['*'];
        }
        if (selectedRule) {
            abstractSyntaxTree.nodes[0].nodes = astRules.nodes.reduce(filterDeclarations(selectedRule), []);
        }
        return abstractSyntaxTree;
    }
    /**
   * Extracts the style attributes from an AbstractSyntaxTree and formats those
   * values in the inline style attribute format.
   *
   * @param  {AbstractSyntaxTree} filteredAST
   * @return {string}             - Example:
   * "color:yellow;text-align:center !important;font-family:helvetica;"
   */ function stringifyStyleAttributes(filteredAST) {
        return filteredAST.nodes[0].nodes.reduce(function(extractedAttributes, attrObject) {
            extractedAttributes.push(`${attrObject.prop}:${attrObject.value}${attrObject.important ? ' !important' : ''}`);
            return extractedAttributes;
        }, []).join(';');
    }
    /**
    * Filters the existing attributes for the given property. Discards any attributes
    * which don't match the allowlist.
    *
    * @param  {object} selectedRule - Example: { color: red, font-family: helvetica }
    * @param  {array} allowedDeclarationsList - List of declarations
    * which pass the allowlist.
    * @param  {object} attributeObject - Object representing the current css property.
    * @property {string} attributeObject.type - Typically 'declaration'.
    * @property {string} attributeObject.prop - The CSS property, i.e 'color'.
    * @property {string} attributeObject.value - The corresponding value to
    * the css property, i.e 'red'.
    * @return {function} - When used in Array.reduce,
    * will return an array of Declaration objects
    */ function filterDeclarations(selectedRule) {
        return function(allowedDeclarationsList, attributeObject) {
            // If this property is allowlisted...
            if (has(selectedRule, attributeObject.prop)) {
                const matchesRegex = selectedRule[attributeObject.prop].some(function(regularExpression) {
                    return regularExpression.test(attributeObject.value);
                });
                if (matchesRegex) {
                    allowedDeclarationsList.push(attributeObject);
                }
            }
            return allowedDeclarationsList;
        };
    }
    function filterClasses(classes, allowed, allowedGlobs) {
        if (!allowed) {
            // The class attribute is allowed without filtering on this tag
            return classes;
        }
        classes = classes.split(/\s+/);
        return classes.filter(function(clss) {
            return allowed.indexOf(clss) !== -1 || allowedGlobs.some(function(glob) {
                return glob.test(clss);
            });
        }).join(' ');
    }
}
// Defaults are accessible to you so that you can use them as a starting point
// programmatically if you wish
const htmlParserDefaults = {
    decodeEntities: true
};
sanitizeHtml.defaults = {
    allowedTags: [
        // Sections derived from MDN element categories and limited to the more
        // benign categories.
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element
        // Content sectioning
        'address',
        'article',
        'aside',
        'footer',
        'header',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'hgroup',
        'main',
        'nav',
        'section',
        // Text content
        'blockquote',
        'dd',
        'div',
        'dl',
        'dt',
        'figcaption',
        'figure',
        'hr',
        'li',
        'menu',
        'ol',
        'p',
        'pre',
        'ul',
        // Inline text semantics
        'a',
        'abbr',
        'b',
        'bdi',
        'bdo',
        'br',
        'cite',
        'code',
        'data',
        'dfn',
        'em',
        'i',
        'kbd',
        'mark',
        'q',
        'rb',
        'rp',
        'rt',
        'rtc',
        'ruby',
        's',
        'samp',
        'small',
        'span',
        'strong',
        'sub',
        'sup',
        'time',
        'u',
        'var',
        'wbr',
        // Table content
        'caption',
        'col',
        'colgroup',
        'table',
        'tbody',
        'td',
        'tfoot',
        'th',
        'thead',
        'tr'
    ],
    // Tags that cannot be boolean
    nonBooleanAttributes: [
        'abbr',
        'accept',
        'accept-charset',
        'accesskey',
        'action',
        'allow',
        'alt',
        'as',
        'autocapitalize',
        'autocomplete',
        'blocking',
        'charset',
        'cite',
        'class',
        'color',
        'cols',
        'colspan',
        'content',
        'contenteditable',
        'coords',
        'crossorigin',
        'data',
        'datetime',
        'decoding',
        'dir',
        'dirname',
        'download',
        'draggable',
        'enctype',
        'enterkeyhint',
        'fetchpriority',
        'for',
        'form',
        'formaction',
        'formenctype',
        'formmethod',
        'formtarget',
        'headers',
        'height',
        'hidden',
        'high',
        'href',
        'hreflang',
        'http-equiv',
        'id',
        'imagesizes',
        'imagesrcset',
        'inputmode',
        'integrity',
        'is',
        'itemid',
        'itemprop',
        'itemref',
        'itemtype',
        'kind',
        'label',
        'lang',
        'list',
        'loading',
        'low',
        'max',
        'maxlength',
        'media',
        'method',
        'min',
        'minlength',
        'name',
        'nonce',
        'optimum',
        'pattern',
        'ping',
        'placeholder',
        'popover',
        'popovertarget',
        'popovertargetaction',
        'poster',
        'preload',
        'referrerpolicy',
        'rel',
        'rows',
        'rowspan',
        'sandbox',
        'scope',
        'shape',
        'size',
        'sizes',
        'slot',
        'span',
        'spellcheck',
        'src',
        'srcdoc',
        'srclang',
        'srcset',
        'start',
        'step',
        'style',
        'tabindex',
        'target',
        'title',
        'translate',
        'type',
        'usemap',
        'value',
        'width',
        'wrap',
        // Event handlers
        'onauxclick',
        'onafterprint',
        'onbeforematch',
        'onbeforeprint',
        'onbeforeunload',
        'onbeforetoggle',
        'onblur',
        'oncancel',
        'oncanplay',
        'oncanplaythrough',
        'onchange',
        'onclick',
        'onclose',
        'oncontextlost',
        'oncontextmenu',
        'oncontextrestored',
        'oncopy',
        'oncuechange',
        'oncut',
        'ondblclick',
        'ondrag',
        'ondragend',
        'ondragenter',
        'ondragleave',
        'ondragover',
        'ondragstart',
        'ondrop',
        'ondurationchange',
        'onemptied',
        'onended',
        'onerror',
        'onfocus',
        'onformdata',
        'onhashchange',
        'oninput',
        'oninvalid',
        'onkeydown',
        'onkeypress',
        'onkeyup',
        'onlanguagechange',
        'onload',
        'onloadeddata',
        'onloadedmetadata',
        'onloadstart',
        'onmessage',
        'onmessageerror',
        'onmousedown',
        'onmouseenter',
        'onmouseleave',
        'onmousemove',
        'onmouseout',
        'onmouseover',
        'onmouseup',
        'onoffline',
        'ononline',
        'onpagehide',
        'onpageshow',
        'onpaste',
        'onpause',
        'onplay',
        'onplaying',
        'onpopstate',
        'onprogress',
        'onratechange',
        'onreset',
        'onresize',
        'onrejectionhandled',
        'onscroll',
        'onscrollend',
        'onsecuritypolicyviolation',
        'onseeked',
        'onseeking',
        'onselect',
        'onslotchange',
        'onstalled',
        'onstorage',
        'onsubmit',
        'onsuspend',
        'ontimeupdate',
        'ontoggle',
        'onunhandledrejection',
        'onunload',
        'onvolumechange',
        'onwaiting',
        'onwheel'
    ],
    disallowedTagsMode: 'discard',
    allowedAttributes: {
        a: [
            'href',
            'name',
            'target'
        ],
        // We don't currently allow img itself by default, but
        // these attributes would make sense if we did.
        img: [
            'src',
            'srcset',
            'alt',
            'title',
            'width',
            'height',
            'loading'
        ]
    },
    allowedEmptyAttributes: [
        'alt'
    ],
    // Lots of these won't come up by default because we don't allow them
    selfClosing: [
        'img',
        'br',
        'hr',
        'area',
        'base',
        'basefont',
        'input',
        'link',
        'meta'
    ],
    // URL schemes we permit
    allowedSchemes: [
        'http',
        'https',
        'ftp',
        'mailto',
        'tel'
    ],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: [
        'href',
        'src',
        'cite'
    ],
    allowProtocolRelative: true,
    enforceHtmlBoundary: false,
    parseStyleAttributes: true,
    preserveEscapedAttributes: false
};
sanitizeHtml.simpleTransform = function(newTagName, newAttribs, merge) {
    merge = merge === undefined ? true : merge;
    newAttribs = newAttribs || {};
    return function(tagName, attribs) {
        let attrib;
        if (merge) {
            for(attrib in newAttribs){
                attribs[attrib] = newAttribs[attrib];
            }
        } else {
            attribs = newAttribs;
        }
        return {
            tagName: newTagName,
            attribs
        };
    };
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__13gh38.._.js.map