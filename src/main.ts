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

const plugin: tstl.Plugin = {
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
	beforeEmit(_program, _options, _emitHost, result) {
		for (const file of result) {
			if (file.code.includes('function __TS__ArrayForEach')) {
				file.code = file.code.replace(ARRAY_FOR_EACH_PATTERN, MA3_ARRAY_FOR_EACH);
			}
		}
	},
};

export default plugin;
