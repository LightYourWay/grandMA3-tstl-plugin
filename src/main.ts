import * as ts from 'typescript';
import * as tstl from 'typescript-to-lua';

const plugin: tstl.Plugin = {
	visitors: {
		[ts.SyntaxKind.ExportAssignment]: (node, context) => {
			const expressions: tstl.Expression[] = [];

			if (ts.isArrayLiteralExpression(node.expression)) {
				for (const element of node.expression.elements) {
					const expression = context.transformExpression(element);
					expressions.push(expression);
				}
			}

			return tstl.createReturnStatement(expressions, node);
		},
	},
};

export default plugin;
