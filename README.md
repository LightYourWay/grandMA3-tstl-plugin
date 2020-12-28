# grandMA3 TypeScriptToLua Plugin
a TypeScriptToLua plugin that allows for direct export to grandMA3 compatible Lua files

## install
```bash
git clone https://github.com/LightYourWay/grandMA3-tstl-plugin.git && \
cd <your-plugin-folder> && \
npm link ../grandMA3-tstl-plugin
```

## integrate into `tsconfig.json`
```json
{
    "tstl": {
        "luaPlugins": [
            { "name": "grandMA3-tstl-plugin/fix_export.ts" }
        ]
    }
}
```

## usage example
```Typescript
// ****************************************************************
// plugin main entry point 
// ****************************************************************
local function Main(display_handle: number, argument: any) {

}

// ****************************************************************
// plugin exit cleanup entry point 
// ****************************************************************
local function Cleanup() {

}

// ****************************************************************
// plugin execute entry point 
// ****************************************************************
local function Execute(Type: string, ...args: any[]) {

}

// ****************************************************************
// return the entry points of this plugin
// ****************************************************************
export = [Main, Cleanup, Execute]
```

**transpiles to:**

```Lua
local function Main(display_handle, argument)
end

local function Cleanup()
end

local function Execute(Type, ...)
end

return Main, Cleanup, Execute
```