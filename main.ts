import { match } from 'assert';
import { Command, App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Menu, EditorSuggest, EditorPosition, EditorSuggestTriggerInfo, TFile, EditorSuggestContext, getAllTags } from 'obsidian';
import { __awaiter } from 'tslib';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}


class TagSuggesEntry {
	constructor(
		public tag: string,
	) { }
}



class TagSuggest extends EditorSuggest<TagSuggesEntry> {
	private plugin: MyPlugin;

	constructor(plugin: MyPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		let line = editor.getLine(cursor.line).substring(0, cursor.ch);
		let tag = line.match(/@\w*/)?.last();

		if (tag) {
			let test: EditorPosition = {
				ch: 1,
				line: 1,
			};

			return {
				start: {
					ch: line.lastIndexOf('@'),
					line: cursor.line,
				},
				end: cursor,
				query: tag.substring(1),
			};
		}

		return null;
	}

	_isSubsequence(s: string, sub: string): boolean {
		let i = 0, j = 0;
		while (i < s.length && j < sub.length) {
			if (s[i] === sub[j]) {
				j++;
			}
			i++;
		}
		return j === sub.length;
	}

	async getFileTags(file: TFile) {
		let cache = this.plugin.app.metadataCache.getFileCache(file);

		if (cache == undefined) {
			return [];
		}

		const tags = getAllTags(cache) ?? [];

		tags.forEach((tag: string, index) => {
			tags[index] = tag.replace("#", "");
		});

		return tags;
	}

	async getSuggestions(context: EditorSuggestContext): Promise<TagSuggesEntry[]> {
		let currTags = context.editor
			.getValue()
			.match(/#[^ !@#$%^&*(),.?":{}|<>]*/g)
			?.map((v) => v.substring(1)) ?? [];

		const ARRAY_SIZE = 10;
		let tagCount = new Map<string, number[]>();
		let files = context.file.vault.getMarkdownFiles().filter((file) => {
			return file != context.file;
		});


		let fileTags = await Promise.all(files.map((file) => this.getFileTags(file)));

		for (let tags of fileTags) {
			let score = tags?.filter((t) => currTags?.includes(t)).length;
			if (score === undefined) {
				continue
			}
			score = Math.min(score, ARRAY_SIZE);
			for (let tag of tags ?? []) {
				let curr = tagCount.get(tag) ?? Array(ARRAY_SIZE).fill(0);
				curr[score]++;
				tagCount.set(tag, curr);
			}
		}



		return Array.from(tagCount.keys())
			.sort(function (a, b) {
				let aScore = tagCount.get(a)!;
				let bScore = tagCount.get(b)!;
				for (let i = ARRAY_SIZE; i >= 0; i--) {
					if (aScore[i] == bScore[i]) {
						continue;
					}
					return bScore[i] - aScore[i];
				}
				return 0;
			})
			.filter((v) => this._isSubsequence(v, context.query) && !currTags?.contains(v))
			.map((v) => new TagSuggesEntry(v));
	}

	renderSuggestion(value: TagSuggesEntry, el: HTMLElement): void {
		el.createEl('div', { text: `${value.tag}` })
	}

	selectSuggestion(value: TagSuggesEntry, evt: MouseEvent | KeyboardEvent): void {
		this.context?.editor.replaceRange(`#${value.tag} `, this.context.start, this.context.end);
	}


}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {

		await this.loadSettings();
		this.registerEditorSuggest(new TagSuggest(this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
