import * as vscode from 'vscode';
import * as error from './../util/error';
import * as dx from './dx';
import * as ccr from '../dx/generator';
import {SObjectCategory} from '../dx/describe';

export default async function codeCompletionRefresh(context: vscode.ExtensionContext): Promise<any> {
    vscode.window.forceCode.statusBarItem.text = 'ForceCode: Refresh Objects from Org';
    
    let options: vscode.QuickPickItem[] = [{
        description: 'Generate faux classes for all objects',
        label: 'All',
    }, {
        description: 'Generate faux classes for standard objects',
        label: 'Standard',
    }, {
        description: 'Generate faux classes for custom objects',
        label: 'Custom',
    }];
    let config: {} = {
        matchOnDescription: true,
        matchOnDetail: true,
        placeHolder: 'Run a command',
    };
    var objectsToGet: SObjectCategory;
    await vscode.window.showQuickPick(options, config).then((res: vscode.QuickPickItem) => {
        if(res === undefined) {
            vscode.window.forceCode.resetMenu();
            return Promise.reject('No choice selected');
        }
        if(res.label === 'All') {
            objectsToGet = SObjectCategory.ALL;
        } else if(res.label === 'Standard') {
            objectsToGet = SObjectCategory.STANDARD;
        } else {
            objectsToGet = SObjectCategory.CUSTOM;
        }
        vscode.window.forceCode.statusBarItem.text = 'ForceCode: Refreshing ' + res.label + ' Objects from Org, this could take a VERY LONG TIME!!!';
    }).then(async function() {
        vscode.window.forceCode.outputChannel.clear();
        vscode.window.forceCode.outputChannel.show();
        var gen = new ccr.FauxClassGenerator();
        try {
            var startTime = (new Date()).getTime();
            await gen.generate(vscode.workspace.rootPath, objectsToGet);
            var endTime = (new Date()).getTime();
            vscode.window.forceCode.outputChannel.appendLine('Refresh took ' + Math.round((endTime - startTime) / (1000 * 60)) + ' minutes.');
            vscode.window.forceCode.statusBarItem.text = 'ForceCode: Retrieval of objects complete!!!';
            vscode.window.forceCode.resetMenu();
            return Promise.resolve();
        } catch(e) {
            return Promise.reject(error.outputError(e, vscode.window.forceCode.outputChannel));
        }
    });
    // =======================================================================================================================================
}
