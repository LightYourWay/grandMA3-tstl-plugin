import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

// tstl's stock __TS__ArrayForEach misbehaves under MA3's Lua runtime — `#arr`
// can under-report and falsy entries break the for-loop. Swap it for a while-
// based variant that extends the iteration past nil holes and passes `_G` as
// the callback receiver.
const ARRAY_FOR_EACH_PATTERN = /function __TS__ArrayForEach(.+\n)+/g;
const MA3_ARRAY_FOR_EACH = `function __TS__ArrayForEach(arr, callbackFn)
	do
		local i = 0
		local arrLength = #arr
		while i < arrLength do
			if arr[i + 1] then
				callbackFn(_G, arr[i + 1], i, arr)
			else
				arrLength = arrLength + 1
			end
			i = i + 1
		end
	end
end
`;

// Derive the MA3 XML Path attribute from the bundle's directory. When the
// bundle lives inside a MALightingTechnology plugins/lib_plugins tree, strip
// everything up to and including that folder — MA3 imports require the Path
// to be relative to the plugins root. Otherwise fall back to a best-guess
// /<repo>/<bundle-dir> shape.
function deriveXmlPath(bundleDir: string): string {
	const normalized = bundleDir.replace(/\\/g, '/');
	const inMAStructure = normalized.includes('MALightingTechnology');
	const inPluginsFolder = normalized.includes('plugins') || normalized.includes('lib_plugins');
	if (inMAStructure && inPluginsFolder) {
		return normalized.replace(/.+?(?:\/plugins|\/lib_plugins)(.+)/g, '$1');
	}
	const repoName = path.basename(path.dirname(normalized));
	const bundleParentName = path.basename(normalized);
	return `/${repoName}/${bundleParentName}`;
}

interface ConsumerPkg {
	name: string;
	version: string;
	author: string;
	gma_version: string;
}

// Options supplied via `luaPlugins[i]` in tsconfig.
interface PluginOptions {
	name: string;
	// Path (relative to tsconfig) to a license file whose contents are
	// prepended to the Lua bundle as `--` comments. `[year]` and `[fullname]`
	// placeholders are substituted with the current year and `pkg.author`.
	license?: string;
}

export default function (pluginOptions: PluginOptions): tstl.Plugin {
	return {
		visitors: {
			[ts.SyntaxKind.ExportAssignment](node, context) {
				if (ts.isArrayLiteralExpression(node.expression)) {
					const expressions: tstl.Expression[] = [];

					for (const element of node.expression.elements) {
						expressions.push(context.transformExpression(element));
					}

					return tstl.createReturnStatement(expressions, node);
				}

				return context.superTransformStatements(node);
			},
		},

		beforeEmit(_program, options, _emitHost, result) {
			// 1. Patch tstl's __TS__ArrayForEach lualib helper.
			for (const file of result) {
				if (file.code.includes('function __TS__ArrayForEach')) {
					file.code = file.code.replace(ARRAY_FOR_EACH_PATTERN, MA3_ARRAY_FOR_EACH);
				}
			}

			// 2. Locate the bundle. We only package when a single `luaBundle` is set.
			const luaBundleOpt = (options as { luaBundle?: string }).luaBundle;
			if (!luaBundleOpt) return;

			const consumerRoot = options.configFilePath
				? path.dirname(options.configFilePath)
				: process.cwd();

			const pkgPath = path.join(consumerRoot, 'package.json');
			if (!fs.existsSync(pkgPath)) return;
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as ConsumerPkg;
			const componentName = pkg.name;

			// 3. If `luaBundle` is a directory (no `.lua` extension), place
			//    `<pkg.name>.lua` inside it. Otherwise honor the configured file path.
			const luaBundleAbs = path.resolve(consumerRoot, luaBundleOpt);
			const treatAsDirectory = !luaBundleAbs.toLowerCase().endsWith('.lua');
			const bundleAbs = treatAsDirectory
				? path.join(luaBundleAbs, `${componentName}.lua`)
				: luaBundleAbs;

			const bundle = result.find((f) => path.resolve(consumerRoot, f.outputPath) === luaBundleAbs);
			if (!bundle) return;

			if (treatAsDirectory) {
				bundle.outputPath = bundleAbs;
			}

			// 4. Optionally prepend the license file as Lua comments.
			if (pluginOptions.license) {
				const licensePath = path.resolve(consumerRoot, pluginOptions.license);
				if (fs.existsSync(licensePath)) {
					const year = `${new Date().getFullYear()}`;
					const license = fs
						.readFileSync(licensePath, 'utf8')
						.split(/\r?\n/)
						.map((line) => `-- ${line.replace('[year]', year).replace('[fullname]', pkg.author)}`)
						.join('\n');
					bundle.code = `${license}\n${bundle.code}`;
				}
			}

			// 5. Emit the matching MA3 plugin XML next to the bundle.
			const bundleDir = path.dirname(bundleAbs);
			const luaFileName = path.basename(bundleAbs);
			const xmlPath = deriveXmlPath(bundleDir);

			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GMA3 DataVersion="${pkg.gma_version}">
    <Plugin Name="${componentName}" Version="${pkg.version}" Author="${pkg.author}" Path="${xmlPath}">
        <ComponentLua Name="${componentName}" FileName="${luaFileName}">
        </ComponentLua>
    </Plugin>
</GMA3>
`;

			result.push({
				outputPath: path.join(bundleDir, `${componentName}.xml`),
				code: xml,
			});
		},
	};
}
