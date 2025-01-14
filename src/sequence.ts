import * as path from 'path';
import * as fs from 'fs';
import { TextFile, nlpFileType } from './textFile'
import { genFileType, TreeFile } from './treeFile'
import { dirfuncs } from './dirfuncs'
import { visualText } from './server'

export enum moveDirection { UP, DOWN }
export enum newPassType { RULES, CODE, DECL }

export class PassItem {
	public filepath: string = '';
	public text: string = '';
	public name: string = '';
	public comment: string = '';
	public passNum: number = 0;
	public row: number = 0;
	public tokenizer: boolean = false;
	public typeStr: string = '';
	public inFolder: boolean = false;
	public empty: boolean = true;
	public active: boolean = true;
	public highlightFile: boolean = false;

	public tokenizers: string[] = ['tokenize','tok','token','cmltokenize','cmltok','dicttok','dicttokz','chartok'];

	constructor() {
	}

	public isTokenizer() {
		return this.tokenizers.includes(this.typeStr.toLowerCase());
	}

	// public fetchTooltip(): string {
	// 	var index = this.tokenizers.indexOf(this.typeStr);
	// 	var tooltip = this.tokenizerTooltips[index];
	// 	return tooltip;
	// }

	public isRuleFile(): boolean {
		return this.typeStr.localeCompare('nlp') == 0 || this.typeStr.localeCompare('rec') == 0;
	}
	
	public isFolder(): boolean {
		return this.typeStr.localeCompare('folder') == 0;
	}
		
	public isStub(): boolean {
		return this.typeStr.localeCompare('stub') == 0;
	}
	
	public isEnd(name: string) {
		return this.typeStr.localeCompare('end') == 0 && this.name.localeCompare(name) == 0;
	}

	public fileExists(): boolean {
		return fs.existsSync(this.filepath) ? true : false;
	}

	public exists(): boolean {
		return this.empty ? false : true;
	}

	public isEmpty(): boolean {
		return this.empty;
	}

	clear() {
		this.text = '';
		this.name = '';
		this.comment = '';
		this.passNum = 0;
		this.row = 0;
		this.typeStr = '';
		this.inFolder = false;
		this.empty = true;
		this.active = true;
		this.highlightFile = false;
	}
}

export class SequenceFile extends TextFile {
	private specDir = '';
	private passItems = new Array();
	private cleanpasses = new Array();
	private newcontent: string = '';
	private currentPassNum: number = 0;

	constructor() {
		super();
	}

	init() {
		if (this.specDir) {
			this.getPassFiles(this.specDir);
		}
	}

	public setSpecDir(specDir: string) {
		this.specDir = specDir;
	}

	public getPassFiles(specDir: string, addSpec: boolean = false) {
		specDir = addSpec ? path.join(specDir,visualText.ANALYZER_SEQUENCE_FOLDER) : specDir;
		if (addSpec) 
			this.setSpecDir(specDir);

		const anaFile = path.join(specDir,visualText.ANALYZER_SEQUENCE_FILE);
		super.setFile(anaFile,true);
		let passNum = 1;
		this.passItems = [];
		var folder = '';
		var row = 0;

		for (let passStr of this.getLines()) {
			var passItem = this.setPass(passStr,passNum);
			if (passItem.typeStr == 'folder' || passItem.typeStr == 'stub') {
				folder = passItem.name;
			} else if (folder.length) {
				if (passItem.typeStr == 'end' &&  passItem.name.localeCompare(folder) == 0) {
					folder = '';
				} else {
					passItem.inFolder = true;
					passNum++;
				}
			} else if (passItem.exists())
				passNum++;

			if (passItem.text.length) {
				passItem.row = row++;
				passItem.filepath = path.join(specDir,passItem.name + '.nlp');
				this.hasHighLightFile(passItem);
				this.passItems.push(passItem);
			}
		}
	}

	public getPassItemFiles(): string[] {
		let files: string[] = new Array();
		for (let passItem of this.passItems) {
			files.push(passItem.filepath);
		}
		return files;
	}

	public getPassItems() {
		return this.passItems;
	}

	public getPassNumber(): number {
		return this.currentPassNum;
	}

	public setPassNum(num: number) {
		this.currentPassNum = num;
	}

	public getPassItem(num: number): PassItem {
		return this.passItems[num-1];
	}

	public getCurrentItem(): PassItem {
		return this.passItems[this.currentPassNum-1];
	}

	public getLastItem(): PassItem {
		return this.passItems[this.passItems.length-1];
	}

	public genHighlightFile(genType: genFileType = genFileType.TXXT) {
		const treeFile = new TreeFile();
		let filePath = this.getOutputFile(this.currentPassNum,nlpFileType.TREE);
		treeFile.setFile(filePath);
		treeFile.parseFireds(filePath);
		const newFile = treeFile.writeFiredText(filePath,genType);
		return newFile;
	}

	public getLastItemInFolder(row: number): PassItem {
		let folderItem = this.passItems[row];
		for (let i=row; i<this.passItems.length; i++) {
			let passItem = this.passItems[i];
			if (passItem.name.localeCompare(folderItem.name) == 0 && passItem.typeStr.localeCompare('end') == 0)
				return passItem;
		}
		return folderItem;
	}

	isOrphan(nlpFileName: string): boolean {
		for (let passItem of this.passItems) {
			if (passItem.name.localeCompare(nlpFileName) == 0)
				return false;
		}
		return true;
	}

	setPass(passStr: string, passNum: number): PassItem {
		const passItem = new PassItem();
		var tokens = passStr.split(/[\t\s]/);

		if (tokens.length >= 3) {
			passItem.text = passStr;
			passItem.passNum = passNum;

			if (tokens[0].localeCompare('#') == 0) {
				passItem.comment = this.tokenStr(tokens,2);
				passItem.typeStr = '#';

			} else {
				var clean = tokens[0].replace('/','');
				if (clean.length < tokens[0].length) {
					passItem.active = false;
					passItem.typeStr = clean;
				} else {
					passItem.active = true;
					passItem.typeStr = tokens[0];
					if (passItem.isTokenizer()) {
						passItem.tokenizer = true;
					}
				}
				passItem.name = tokens[1];
				if (passItem.typeStr.localeCompare('pat') == 0) {
					passItem.typeStr = 'nlp';
				}

				if (passItem.typeStr.localeCompare('nlp') == 0 || passItem.typeStr.localeCompare('rec') == 0) {
					passItem.filepath = this.passItemPath(passItem);
				}
				passItem.comment = this.tokenStr(tokens,2);				
			}
			passItem.empty = false;
		}

		return passItem;
	}

	passItemPath(passItem: PassItem): string {
		passItem.filepath = path.join(this.specDir,passItem.name + '.pat');
		if (!fs.existsSync(passItem.filepath))
			passItem.filepath = path.join(this.specDir,passItem.name + '.nlp');
		return passItem.filepath;
	}

	tokenStr(tokens: string[], start: number): string {
		var tokenStr = '';
		let i = 0;
		let end = tokens.length;
		for (i=start; i<end; i++) {
			var tok = tokens[i];
			if (tokenStr.length)
				tokenStr = tokenStr + ' ';
			tokenStr = tokenStr + tok;
		}
		return tokenStr;
	}

	passString(passItem: PassItem): string {
		var activeStr = passItem.active ? '' : '/';
		return activeStr + passItem.typeStr + '\t' + passItem.name + '\t' + passItem.comment;
	}

	base(passname: string): string {
		var basename = path.basename(passname,'.pat');
		basename = path.basename(basename,'.nlp');
		return basename;
	}

	getPassByRow(row: number): PassItem {
		for (let passItem of this.passItems) {
			if (passItem.row == row)
				return passItem;
		}
		return new PassItem();
	}

	getPassByNumber(passNumber: number): PassItem {
		for (let passItem of this.passItems) {
			if (passItem.passNum == passNumber)
				return passItem;
		}
		return new PassItem();
	}

	getPathByPassNumber(passNumber: number): string {
		var passItem = this.getPassByNumber(passNumber);
		if (!passItem.isEmpty())
			return passItem.filepath;
		return '';
	}

	passCount(): number {
		return this.passItems.length;
	}

	atBottom(passItem: PassItem): boolean {
		let passes = this.getFolderPasses(passItem.typeStr,passItem.name,true);
		return passes.length + passItem.row == this.passCount();
	}

	cleanPasses() {
		this.cleanpasses = [];
		let passNum = 1;
		for (let passItem of this.passItems) {
			this.cleanpasses.push(this.passString(passItem));
		}
	}

	inFolder(passItem: PassItem): boolean {
		var passes = this.getPasses();
		var row = passes[passItem.row].row;
		while (row) {
			row--;
			var currentPass = passes[row];
			if (currentPass.typeStr == 'end') {
				return false;
			}
			else if (currentPass.typeStr == 'folder') {
				return true;
			}
		}
		return false;
	}

	renamePass(name: string, type: string, newPassName: string) {
		if (this.passItems.length) {
			var passItem = this.findPass(type,name);
			if (type.localeCompare('folder') == 0) {
				var passes = this.getFolderPasses(type,name,true);
				passes[passes.length-1].name = newPassName;
			}
			passItem.name = newPassName;
			this.saveFile();
		}
	}

	duplicatePass(name: string, type: string, newPassName: string) {
		if (this.passItems.length) {
			var passItem = this.findPass(type,name);
			var dupePath = path.join(path.dirname(passItem.filepath),newPassName + '.nlp');
			fs.copyFileSync(passItem.filepath,dupePath);									
			var dupeItem = this.createPassItemFromFile(dupePath);
			this.passItems.splice(passItem.row+1,0,dupeItem);
			this.saveFile();
		}
	}
	
	insertPass(row: number, newpass: string): number {
		if (this.passItems.length) {

			if (row >= 0) {
				var passes = new Array();
				passes.push(newpass);
				var copy = false;
				const specDir = visualText.analyzer.getSpecDirectory();

				if (specDir.localeCompare(path.dirname(newpass))) {
					if (dirfuncs.isDir(newpass)) {
						passes = [];
						passes = dirfuncs.getFiles(newpass);
					}
					copy = true;
				}
				var pi = this.passItems[0];
				for (let pass of passes) {
					var passPath = path.join(specDir,path.basename(pass.fsPath));
					if (copy) {
						fs.copyFileSync(pass.fsPath,passPath);								
					}		
					pi = this.createPassItemFromFile(passPath);
					row++;
					this.passItems.splice(row,0,pi);
				}
				this.saveFile();
				this.renumberPasses();
			}
		}
		return row;
	}

	findPassByFilename(filename: string): number {
		var passes = this.getPasses();
		var name = path.parse(filename).name;
		for (let pass of passes) {
			if (pass.name == name) {
				return pass.passNum;
			}
		}
		return 0;
	}
		
	insertNewPass(name: string, type: string, newPass: string, passtype: newPassType) {
		if (this.passItems.length && newPass.length) {
			var foundItem = this.findPass(type,name);
			if (foundItem) {
				var newfile = this.createNewPassFile(newPass,passtype);
				var passItem = this.createPassItemFromFile(newfile);
				this.passItems.splice(foundItem.row+1,0,passItem);
				this.saveFile();			
			}
		}	
	}

	insertNewPassEnd(newpass: string, type: newPassType) {
		if (this.passItems.length && newpass.length) {
			var newfile = this.createNewPassFile(newpass,type);
			var passItem = this.createPassItemFromFile(newfile);
			this.passItems.push(passItem);
			this.saveFile();			
		}
	}
			
	insertNewFolderPass(row: number, folderName: string, type: string): number {
		const passItem = this.getPassByRow(row);
		if (folderName.length) {
			if (passItem) {
				const newPassItem = this.createPassItemFolder(type,folderName);
				newPassItem.row = row+1;
				newPassItem.passNum = passItem.passNum;
				this.passItems.splice(newPassItem.row,0,newPassItem);
				this.saveFile();
				return newPassItem.row;		
			}
		}
		return row;
	}

	insertNewFolder(name: string, type: string, newFolder: string) {
		if (this.passItems.length && newFolder.length) {
			var foundItem = this.findPass(type,name);
			if (foundItem) {
				if (foundItem.isFolder()) {
					foundItem = this.moveToFolderEnd(foundItem);
				}	
				var passItem = this.createPassItemFolder('end',newFolder);
				this.passItems.splice(foundItem.row+1,0,passItem);
				passItem = this.createPassItemFolder('folder',newFolder);
				this.passItems.splice(foundItem.row+1,0,passItem);
				this.saveFile();	
			}		
		}
	}

	moveToFolderEnd(passItem: PassItem): PassItem {
		var passes = this.getFolderPasses(passItem.typeStr,passItem.name,true);
		return passes[passes.length-1];
	}	

	insertNewFolderEnd(newFolder: string) {
		if (this.passItems.length && newFolder.length) {
			var passItem = this.createPassItemFolder('folder',newFolder);
			this.passItems.push(passItem);
			passItem = this.createPassItemFolder('end',newFolder);
			this.passItems.push(passItem);
			this.saveFile();			
		}	
	}

	createPassItemFolder(type: string, name: string): PassItem {
		var passItem = new PassItem();
		passItem.typeStr = type;
		passItem.name = name;
		passItem.comment = '# new folder';
		return passItem;
	}

	deletePass(name: string, type: string, ) {
		let passItem = this.findPass(type,name);
		if (passItem.isFolder()) {
			this.deleteFolder(passItem);
		} else
			this.deletePassInSeqFile(passItem.typeStr,passItem.name);
		this.saveFile();
	}

	deleteFolder(passItem: PassItem, foldersOnly: boolean=false) {
		let passes = this.getFolderPasses(passItem.typeStr,passItem.name,true);
		if (foldersOnly) {
			let len = passes.length;
			let first = passes[0];
			let last = passes[len-1];
			this.deletePassInSeqFile(last.typeStr,last.name);
			this.deletePassInSeqFile(first.typeStr,first.name);
		} else {
			this.passItems.splice(passes[0].row,passes.length);
		}
	}

	deletePassInSeqFile(type: string, name: string) {
		var passItem = this.findPass(type, name);
		if (passItem) {
			this.passItems.splice(passItem.row,1);
		}
	}

	createNewPassFile(filename: string, type: newPassType): string {
		var newfilepath = path.join(visualText.analyzer.getSpecDirectory(),filename.concat('.nlp'));
		fs.writeFileSync(newfilepath,this.newPassContent(filename,type),{flag:'w+'});
		return newfilepath;
	}

	todayDate(): string {
		var today = new Date();
		var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
		var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
		return date + ' ' + time;
	}

	newPassContent(filename: string, type: newPassType) {
		// const config = vscode.workspace.getConfiguration('user');
        // var username = config.get<string>('name');
		let username = 'de Hilster';
		if (username?.length == 0)
			username = 'Your Name';
		var newpass = '###############################################\n';
		newpass = newpass.concat('# FILE: ',filename,'\n');
		newpass = newpass.concat('# SUBJ: comment\n');
		newpass = newpass.concat(`# AUTH: ${username}\n`);
		newpass = newpass.concat('# CREATED: ',this.todayDate(),'\n');
		newpass = newpass.concat('# MODIFIED:\n');
		newpass = newpass.concat('###############################################\n\n');

		switch (type) {
			case newPassType.RULES:
				newpass = newpass.concat('@NODES _ROOT\n\n');

				newpass = newpass.concat('@RULES\n');
				newpass = newpass.concat('_xNIL <-\n');
				newpass = newpass.concat('	_xNIL	### (1)\n');
				newpass = newpass.concat('	@@\n');
				break;

			case newPassType.CODE:
				newpass = newpass.concat('@CODE\n\n');
				newpass = newpass.concat('G("kb") = getconcept(findroot(),"kb");\n');
				newpass = newpass.concat('SaveKB("mykb.kbb",G("kb"),2);\n');
				newpass = newpass.concat('\n@@CODE');
				break;

			case newPassType.DECL:
				newpass = newpass.concat('@DECL\n\n');
				newpass = newpass.concat('MyFunction(L("var")) {\n');
				newpass = newpass.concat('\n');
				newpass = newpass.concat('}\n');
				newpass = newpass.concat('\n@@DECL');
				break;
		}

		return newpass;
	}

	createPassItemFromFile(filePath: string): PassItem {
		const passItem = new PassItem();
		passItem.filepath = filePath;
		passItem.name = this.base(filePath);
		passItem.typeStr = path.extname(filePath).substring(1);
		passItem.comment = '# comment';
		passItem.text = this.passString(passItem);
		passItem.empty = false;
		return passItem;
	}

	passFileName(passName: string): string {
		return passName.concat('.nlp');
	}

	getFolderPasses(type: string, name: string, includeStubs: boolean = false): PassItem[]  {
		var passes = Array();
		var collect = '';

		for (let pass of this.getPasses()) {

			if (collect.length == 0 && pass.typeStr.localeCompare(type) == 0 && pass.name.localeCompare(name) == 0) {
				collect = pass.name;
				if (includeStubs)
					passes.push(pass);

			} else if (collect.length) {
				if (pass.typeStr.localeCompare('end') == 0 && pass.name.localeCompare(collect) == 0) {
					if (includeStubs)
						passes.push(pass);
					break;
				} else {
					passes.push(pass);
				}
			}
		}

		return passes;
	}

	getPasses(): PassItem[] {
		if (this.passItems.length == 0) {
			this.init();
		}
		return this.passItems;
	}

	getPassFilePaths(topFlag: boolean): string[] {
		let files: string[] = new Array();
		let infolder: boolean = false;
		for (let pass of this.getPasses()) {
			if (topFlag) {
				if (pass.typeStr == 'folder') {
					infolder = true;
				} else if (pass.typeStr == 'end') {
					infolder = false;
				}
			}
			if (!infolder && pass.typeStr == 'nlp' && pass.filepath && pass.filepath.length > 4)
				files.push(pass.filepath);
		}
		return files;
	}

	getSequenceFile(): string {
		var dir = visualText.analyzer.getSpecDirectory();
		if (dir.length)
			dir = path.join(visualText.analyzer.getSpecDirectory(),visualText.ANALYZER_SEQUENCE_FILE);
		return dir;
	}

	getSpecDirectory(): string {
		return visualText.analyzer.getSpecDirectory();
	}

	saveType(name: string, type: string, passType: string) {
		var passItem = this.findPass(type,name);
		if (passItem.exists()) {
			passItem.typeStr = passType;
			passItem.active = true;
			this.saveFile();
		}
	}

	saveActive(name: string, type: string, active: boolean) {
		var passItem = this.findPass(type,name);
		if (passItem.typeStr == 'folder') {
			var passes: PassItem[] = this.getFolderPasses(passItem.typeStr,passItem.name);
			for (let pass of passes) {
				pass.active = active;
			}
			passItem.active = active;
			var last = passes[passes.length-1];
			last = this.nextPass(last);
			last.active = active;
			this.saveFile();
		}
		else if (passItem.exists()) {
			passItem.active = active;
			this.saveFile();			
		}
	}

	saveFile() {
		this.newcontent = '';
		for (let passItem of this.passItems) {
			if (this.newcontent.length)
				this.newcontent = this.newcontent.concat('\n');
			this.newcontent = this.newcontent.concat(this.passString(passItem));
		}

		fs.writeFileSync(path.join(this.specDir,visualText.ANALYZER_SEQUENCE_FILE),this.newcontent,{flag:'w+'});
	}

	movePass(name: string, type: string, direction: moveDirection) {
		let passItem = this.findPass(type, name);
		let row = passItem.row;

		if (passItem.isRuleFile()) {
			if (direction == moveDirection.UP) {
				let prev = this.passItems[row-1];			
				this.swapItems(passItem,prev);

			} else {
				let next = this.passItems[row+1];			
				this.swapItems(passItem,next);
			}

		} else {
			let nextTop = this.nextTop(passItem);
			let prevTop = this.prevTop(passItem);

			if (direction == moveDirection.DOWN && nextTop.isFolder()) {
				let passesOne = this.getFolderPasses(type,name,true);
				let passesTwo = this.getFolderPasses(nextTop.typeStr,nextTop.name,true);
				let totalPassCount = passesOne.length + passesTwo.length - 1;

				let i = 0;
				let top = passesOne[0].row;
				for (i=0; i<passesOne.length; i++) {
					let pass = this.passItems[top];
					this.moveCount(pass,totalPassCount);
				}

			} else if (direction == moveDirection.UP && prevTop.isFolder()) {
				let passesOne = this.getFolderPasses(prevTop.typeStr,prevTop.name,true);
				let passesTwo = this.getFolderPasses(type,name,true);
				let totalPassCount = passesOne.length + passesTwo.length - 1;

				let i = 0;
				let top = passesOne[0].row;
				let len = passesOne.length;
				for (i=0; i<len; i++) {
					let pass = this.passItems[top];
					this.moveCount(pass,totalPassCount);
				}

			} else {
				let passes = this.getFolderPasses(type,name,true);
				if (direction == moveDirection.UP) {
					row--;
				} else {
					passes = passes.reverse();
					row += passes.length;
				}
				let other = this.passItems[row];	
				for (let pass of passes) {
					this.swapItems(other,pass);
					this.saveFile();
					other = pass;
				}					
			}
		}
		this.renumberPasses();
	}

	renumberPasses() {
		let passNum = 1;
		let row = 1;
		for (let passItem of this.passItems) {
			passItem.row = row++;
			if (passItem.isRuleFile())
				passNum++;
			passItem.passNum = passNum;
			const pause = 1;
		}
		this.passItems;
	}

	moveCount(passItem: PassItem, count: number) {
		let i = 0;
		let pass = passItem;
		let next = passItem;
		for (i=passItem.row; i<count+passItem.row; i++ ) {
			next = this.passItems[i+1];
			this.swapItems(pass,next);
			pass = next;
		}
		this.passItems;
	}
	
	prevNLP(passItem: PassItem): PassItem {
		let row = passItem.row;
		let prev = this.passItems[--row];
		while (prev.typeStr.localeCompare('nlp') != 0) {
			prev = this.passItems[--row];
		}
		return prev;
	}

	prevTop(passItem: PassItem): PassItem {
		let row = passItem.row;
		let prev = this.passItems[--row];
		while (prev.inFolder || prev.typeStr.localeCompare('end') == 0) {
			prev = this.passItems[--row];
		}
		return prev;
	}

	nextPass(passItem: PassItem): PassItem {	
		let row = passItem.row;
		let next = this.passItems[++row];
		return next;
	}

	nextTop(passItem: PassItem): PassItem {
		let row = passItem.row;
		let next = this.passItems[++row];
		while (next.inFolder) {
			next = this.passItems[++row];
		}
		if (next.typeStr.localeCompare('end') == 0)
			next = this.passItems[++row];
		return next;
	}
	
	getOutputFile(passNum: number = this.currentPassNum, type: nlpFileType): string {
		const treeFile = new TreeFile();
		const currPath = process.cwd();
		const dirPath = path.join(path.dirname(this.specDir),'input','text.txt_log');
		const filePath = path.join(currPath,dirPath,treeFile.anaFile(passNum,type));
		return filePath;
	}
	
	hasHighLightFile(passItem: PassItem) {
		const treeFile = this.getOutputFile(passItem.passNum,nlpFileType.TREE);
		if (fs.existsSync(treeFile)) {
			const content = fs.readFileSync(treeFile, 'utf8');
			passItem.highlightFile = content.includes('fired');
		} else {
			passItem.highlightFile = false;
		}
	}

	swapItems(itemOne: PassItem, itemTwo: PassItem) {
		const hold = new PassItem();
		this.copyItem(hold,itemOne);
		this.copyItem(itemOne,itemTwo);	
		this.copyItem(itemTwo,hold);
		this.swapAuxFiles(itemOne,itemTwo,nlpFileType.TXXT);
		this.swapAuxFiles(itemOne,itemTwo,nlpFileType.KBB);
	}

	copyItem(toItem: PassItem, fromItem: PassItem) {
		toItem.text = fromItem.text;
		toItem.name = fromItem.name;
		toItem.tokenizer = fromItem.tokenizer;
		toItem.typeStr = fromItem.typeStr;
		toItem.inFolder = fromItem.inFolder;
		toItem.filepath = fromItem.filepath;
		toItem.comment = fromItem.comment;
		toItem.active = fromItem.active;
	}

	swapAuxFiles(itemOne: PassItem, itemTwo: PassItem, type: nlpFileType) {
		var logFile = new TreeFile();
		var oneFile = logFile.anaFile(itemOne.passNum,type);
		var swapFile = oneFile + ".swap";
		var twoFile = logFile.anaFile(itemTwo.passNum,type);
		var oneExists = fs.existsSync(oneFile);
		var twoExists = fs.existsSync(twoFile);

		if (oneExists && twoExists) {
			fs.copyFileSync(oneFile,swapFile);
			fs.copyFileSync(twoFile,oneFile);
			fs.copyFileSync(swapFile,twoFile);
			dirfuncs.delFile(swapFile);				
		} else if (oneExists) {
			dirfuncs.rename(oneFile,twoFile);
		} else if (twoExists) {
			dirfuncs.rename(twoFile,oneFile);
		}
	}

	findPass(type: string, name: string): PassItem {
		var row = 1;
		var found = false;
		for (let passItem of this.passItems) {
			if (type.localeCompare(passItem.typeStr) == 0 && name.localeCompare(passItem.name) == 0) {
				return passItem;
			}
		}
		return new PassItem();
	}

	findPassFromUri(filepath: string): PassItem {
		var found = false;
		for (let passItem of this.passItems) {
			if (filepath == 'tokenizer pass' || filepath == passItem.uri.fsPath) {
				return passItem;
			}
		}
		return new PassItem();
	}

	genHighLightFile() {
		const treeFile = new TreeFile();
		const passItem = this.getCurrentItem();
		const currPath = process.cwd();
		const dirPath = path.join(path.dirname(this.specDir),'input','text.txt_log');
		for (let passItem of this.passItems) {
			const filePath = path.join(currPath,dirPath,treeFile.anaFile(passItem.passNum,nlpFileType.TXXT));
			if (!fs.existsSync(filePath)) {
				fs.writeFileSync(filePath,'');
			}
		}
	}
}
