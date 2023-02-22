import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	request,
	MetadataCache,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface QueryEmbeddedZettelsSettings {
	filename: string;
	port: string;
}

const DEFAULT_SETTINGS: QueryEmbeddedZettelsSettings = {
	filename: "default",
	port: "text-davinci-003",
};

export default class QueryEmbeddedZettels extends Plugin {
	settings: QueryEmbeddedZettelsSettings;

	// async callOpenAIAPI(
	// 	prompt: string,
	// 	engine = "text-davinci-003",
	// 	max_tokens = 250,
	// 	temperature = 0.3,
	// 	best_of = 3
	// ) {
	// 	const response = await request({
	// 		url: `https://api.openai.com/v1/engines/${engine}/completions`,
	// 		method: "POST",
	// 		headers: {
	// 			Authorization: `Bearer ${this.settings.apiKey}`,
	// 			"Content-Type": "application/json",
	// 		},
	// 		contentType: "application/json",
	// 		body: JSON.stringify({
	// 			prompt: prompt,
	// 			max_tokens: max_tokens,
	// 			temperature: temperature,
	// 			best_of: best_of,
	// 		}),
	// 	});

	// 	const responseJSON = JSON.parse(response);
	// 	return responseJSON.choices[0].text;
	// }

	

	async onload() {
		await this.loadSettings();

		// add a command to summarize text and add it to frontmatter as excerpt
		// this.addCommand({
		// 	id: "summarize-to-frontmatter",
		// 	name: "Add Excerpt to Frontmatter",
		// 	editorCallback: async (editor: Editor, view: MarkdownView) => {
		// 		const metadataMenuPlugin =
		// 			this.app.plugins.plugins["metadata-menu"].api;
		// 		if (!metadataMenuPlugin) {
		// 			new Notice("Metadata Menu plugin not found");
		// 			return;
		// 		}

		// 		const activeFile = view.file;

		// 		if (!activeFile) {
		// 			new Notice("No file open");
		// 			return;
		// 		}

		// 		const { postValues } = app.plugins.plugins["metadata-menu"].api;

		// 		const editField = async (file: any, yamlKey: any, newValue: any) => {
		// 			const fieldsPayload = [
		// 				{
		// 					name: yamlKey,
		// 					payload: {
		// 						value: newValue,
		// 					},
		// 				},
		// 			];
		// 			postValues(file, fieldsPayload);
		// 		};

		// 		const loading = this.addStatusBarItem();
		// 		loading.setText("Loading...");
		// 		const text = editor.getSelection();
		// 		const summaryPrompt = `Summarize this text into one or two sentences in first person format (using "I"):.\n\nText:\n${text}\n\nSummary:\n`;
		// 		const summary = await this.callOpenAIAPI(summaryPrompt, engine, 100);

		// 		await editField(activeFile, "excerpt", summary.trim().replace(/\n/g, " "));
		// 		loading.setText("");
		// 	},
		// });

		// outline > complete sentences
		this.addCommand({
			id: "find-interesting-notes",
			name: "Use Embeddings to Find Interesting Notes",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const text = editor.getSelection();
				// const sentencesPrompt = `Convert this bulleted outline into complete sentence English (maintain the voice and styling (use bold, links, headers and italics Markdown where appropriate)). Each top level bullet is a new paragraph/section. Sub bullets go within the same paragraph. Convert shorthand words into full words.\n\nOutline:\n${text}\n\nComplete Sentences Format:\n`;

				const loading = this.addStatusBarItem();
				loading.setText("Loading...");

				const res = await request({
					url: `http://127.0.0.1:${this.settings.port}/query`,
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						query: text,
						filename: this.settings.filename,
						obsidian_filename: view.file.path.replace(".md", "")
					}),
				});


				// err
				if (res.includes("Error")) {
					new Notice("Error");
					loading.setText("");
					return;
				}

				console.log(res);

				loading.setText("");
				
				try {
					const json = JSON.parse(res);
					const owl = json.owl;
					const raven = json.raven;
					const toucan = json.toucan;
	
					// take filename from full path /path/to/file.md
					const extractFilename = (filename: string) => {
						const parts = filename.split("/");
						return parts[parts.length - 1].replace(".md", "");
					}
	
					const fetchTitle = (content: string) => {
						// get first h1
						const title = content.match(/# (.*)/);
						if (title) {
							return title[1];
						}
						return "";
					}
	
					const sentences = `Similar: ${fetchTitle(owl.contents)} - [[${extractFilename(owl.filename)}]]\n\nClever: ${fetchTitle(raven.contents)} - [[${extractFilename(raven.filename)}]]\n\nChaotic: ${fetchTitle(toucan.contents)} - [[${extractFilename(toucan.filename)}]]\n\n`;
					editor.replaceSelection(
						`${editor.getSelection()}\n\n## AI Generated Read Next\n\n${sentences}`
					);
					loading.setText("");
				} catch (err) {
					loading.setText("");
					new Notice("Error");
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new QueryEmbeddedZettelsTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class QueryEmbeddedZettelsTab extends PluginSettingTab {
	plugin: QueryEmbeddedZettels;

	constructor(app: App, plugin: QueryEmbeddedZettels) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

		new Setting(containerEl)
			.setName("Zettel Parquet File Path")
			.setDesc("Path to your Zettel Parquet file")
			.addText((text) =>
				text
					.setPlaceholder("/path/to/your/zettel.parquet")
					.setValue(this.plugin.settings.filename)
					.onChange(async (value) => {
						console.log("Path: " + value);
						this.plugin.settings.filename = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Port")
			.setDesc("Port to run the server on")
			.addText((text) =>
				text
					.setPlaceholder("5000")
					.setValue(this.plugin.settings.port)
					.onChange(async (value) => {
						console.log("Port: " + value);
						this.plugin.settings.port = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
