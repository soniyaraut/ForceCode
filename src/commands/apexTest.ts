import * as vscode from 'vscode';
import * as parsers from './../parsers';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as error from './../util/error';
import { configuration } from './../services';

export default function apexTest(document: vscode.TextDocument, context: vscode.ExtensionContext): Promise<any> {
    vscode.window.forceCode.statusBarItem.text = 'ForceCode: $(pulse) Running Unit Tests $(pulse)';

    // const body: string = document.getText();
    // const ext: string = parsers.getFileExtension(document);
    const toolingType: string = parsers.getToolingType(document);
    // const fileName: string = parsers.getFileName(document);
    const name: string = parsers.getName(document, toolingType);
    /* tslint:disable */
    var DefType: string = undefined;
    var Format: string = undefined;
    var Source: string = undefined;
    var currentObjectDefinition: any = undefined;
    var AuraDefinitionBundleId: string = undefined;
    var Id: string = undefined;
    /* tslint:enable */
    // Start doing stuff
    return vscode.window.forceCode.connect(context)
        .then(svc => getClassInfo(svc))
        .then(id => runCurrentTests(id))
        .then(showResult)
        .then(showLog)
        .catch(err => error.outputError(err, vscode.window.forceCode.outputChannel));

    function getClassInfo(svc) {
        return vscode.window.forceCode.conn.tooling.sobject(toolingType)
            .find({ Name: name, NamespacePrefix: vscode.window.forceCode.config.prefix || '' }).execute();
    }

    function getTestMethods(info): string[] {
        if (info.SymbolTable) {
            return info.SymbolTable.methods.filter(function (method) {
                return method.annotations.some(function (annotation) {
                    return annotation.name === 'IsTest';
                });
            }).map(function (method) {
                return method.name;
            });
        } else {
            error.outputError({ message: 'no symbol table' }, vscode.window.forceCode.outputChannel);
        }
    }

    function runCurrentTests(results) {
        var info: any = results[0];
        var methodNames: string[] = getTestMethods(info);
        vscode.window.forceCode.statusBarItem.text = 'ForceCode: $(pulse) Running Unit Tests $(pulse)';
        return vscode.window.forceCode.conn.tooling.runUnitTests(info.Id, methodNames);
    }
    // =======================================================================================================================================

    function showResult(res) {
        return configuration().then(config => {

            vscode.window.forceCode.outputChannel.clear();
            if (res.failures.length > 0) {
                vscode.window.forceCode.outputChannel.appendLine('=========================================================   TEST FAILURES   ==========================================================');
                vscode.window.forceCode.statusBarItem.text = 'ForceCode: Some Tests Failed $(thumbsdown)';
            } else {
                vscode.window.forceCode.statusBarItem.text = 'ForceCode: All Tests Passed $(thumbsup)';
            }
            res.failures.forEach(function (failure) {
                var errorMessage: string = 'FAILED: ' + failure.stackTrace + '\n' + failure.message;
                vscode.window.forceCode.outputChannel.appendLine(errorMessage);
            });
            if (res.failures.length > 0) { vscode.window.forceCode.outputChannel.appendLine('======================================================================================================================================='); }
            res.successes.forEach(function (success) {
                var successMessage: string = 'SUCCESS: ' + success.name + ':' + success.methodName + ' - in ' + success.time + 'ms';
                vscode.window.forceCode.outputChannel.appendLine(successMessage);
            });
            // Add Line Coverage information
            if (res.codeCoverage.length > 0) {
                res.codeCoverage.forEach(function (coverage) {
                    vscode.window.forceCode.codeCoverage[coverage.id] = coverage;
                });
            }

            // Add Code Coverage Warnings, maybe as actual Validation Warnings 
            if (res.codeCoverageWarnings.length > 0) {
                res.codeCoverageWarnings.forEach(function (warning) {
                    let docWarn: vscode.TextDocument = vscode.workspace.textDocuments.reduce((prev, curr) => {
                        if (parsers.getFileName(curr).toLowerCase() === 'vscode.window.forceCode.codeCoverage[warning.id].name') {
                            return curr;
                        } else if (prev) {
                            return prev;
                        }
                    });

                    let diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection(docWarn.fileName);
                    let diagnostics: vscode.Diagnostic[] = [];
                    let failureRange: vscode.Range = docWarn.lineAt(0).range;
                    let warningMessage: string = `CODE COVERAGE WARNING: ` + warning.message;
                    diagnostics.push(new vscode.Diagnostic(failureRange, warningMessage, 1));
                    diagnosticCollection.set(docWarn.uri, diagnostics);

                    // vscode.window.forceCode.outputChannel.appendLine(warningMessage);
                });
            }

            vscode.window.forceCode.outputChannel.show();
            return res;
        });
    }
    // TODO: Refactor this and the getLog.ts to use a common function
    // This is Copypasta
    function showLog(res) {
        var url: string = `${vscode.window.forceCode.conn._baseUrl()}/sobjects/ApexLog/${res.apexLogId}/Body`;
        var tempPath: string = `${vscode.workspace.rootPath}${path.sep}.logs${path.sep}${res.apexLogId}.log`;
        if (vscode.window.forceCode.config.showTestLog) {
            vscode.window.forceCode.conn.request(url).then(logBody => {
                fs.stat(tempPath, function (err, stats) {
                    if (err) {
                        return open(vscode.Uri.parse(`untitled:${tempPath}`)).then(show).then(replaceAll);
                    } else {
                        return open(vscode.Uri.parse(`file:${tempPath}`)).then(show).then(replaceAll);
                    }

                    function open(uri) {
                        return vscode.workspace.openTextDocument(uri);
                    }
                    function show(_document) {
                        return vscode.window.showTextDocument(_document, vscode.window.visibleTextEditors.length - 1);
                    }
                    function replaceAll(editor) {
                        var start: vscode.Position = new vscode.Position(0, 0);
                        var lineCount: number = editor.document.lineCount - 1;
                        var lastCharNumber: number = editor.document.lineAt(lineCount).text.length;
                        var end: vscode.Position = new vscode.Position(lineCount, lastCharNumber);
                        var range: vscode.Range = new vscode.Range(start, end);
                        editor.edit(builder => builder.replace(range, debugOnly()));
                    }
                    function debugOnly() {
                        if (vscode.window.forceCode.config.debugOnly) {
                            return logBody.split('\n').filter(l => l.match(new RegExp(vscode.window.forceCode.config.debugFilter || 'USER_DEBUG'))).join('\n');
                        } else {
                            return logBody;
                        }
                    }
                });
            });
        }
        return res;
    }




    // function onError(err): any {
    //     error.outputError(err, vscode.window.forceCode.outputChannel);
    //     return err;
    // }

    // =======================================================================================================================================
}
