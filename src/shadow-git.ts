// Some ideas from Cline source code are used in the module.
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit, LogResult, DefaultLogFields,CheckRepoActions, StatusResult } from 'simple-git';
// import type { GitExtension, API, Repository, InitOptions, LogOptions, Commit, RepositoryState } from './git';
// import * as git from './vscode.git';
import {Application} from "./application";
import { Utils } from './utils';
import { globby } from 'globby';



declare module 'vscode' {
    interface GitExtension {
        readonly enabled: boolean;
        getAPI(version: 1): vscode.GitAPI;
    }

    interface GitAPI {
        repositories: any;
        // Add other methods you need
    }
}

export class ShadowGit {
    private app: Application;
    private workspaceRoot: string = "";
    public git: SimpleGit|undefined = undefined;
    private repoPath: string = "";
    private SHADOW_DIR = '.git';
    private SUFFIX = "_tmp";

    constructor(app: Application) {
        this.app = app;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;
        else this.workspaceRoot = workspaceRoot;

        // const gitExtension = vscode.extensions.getExtension<vscode.GitExtension>('vscode.git');
        // if (!gitExtension || !gitExtension.isActive) {
        //     vscode.window.showErrorMessage('Git extension is not available');
        //     return;
        // } else {
        //     const gitAPI = gitExtension.exports.getAPI(1);
        //     this.workspaceRoot = workspaceRoot;
        //     this.shadowGitDir = path.join(this.context.globalStorageUri.fsPath, "test")// this.app.lruResultCache.getHash(this.workspaceRoot));
        //     this.gitAPI = gitAPI;
        // }
        
    }

    async initialize(repoBasePath: string): Promise<void> {
        // Check if shadow repo already exists
        this.repoPath = repoBasePath;
        let workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceDir) {
            this.repoPath = path.join(this.repoPath, this.app.lruResultCache.getHash(workspaceDir));
            this.workspaceRoot = workspaceDir;
        }

        if (!fs.existsSync(this.repoPath)) fs.mkdirSync(this.repoPath, { recursive: true });
        this.git = simpleGit(this.repoPath);
        const isRepo = await this.git?.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
        if (!isRepo) {                           
            await this.git.init();
            await this.configureShadowGit(this.git);
            // this.setupIgnoreRules();
            await this.updateExcludesFile(this.repoPath)
            try { 
                await this.addChanges()
                if (await this.hasChangesToCommit()){            
                    await this.git.commit("Add files");
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to add files to history: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        } else {
            const worktree = await this.git.getConfig("core.worktree")
			if (worktree.value !== this.workspaceRoot) {
				throw new Error("History can only be used in the original workspace: " + worktree.value)
			}
			console.warn(`Using existing shadow git at ${this.repoPath}`)

			// shadow git repo already exists, but update the excludes just in case
			await this.updateExcludesFile(this.repoPath)
        }
    }

    private async configureShadowGit(git: SimpleGit) {
        await git.addConfig("core.worktree", this.workspaceRoot);
        await git.addConfig("commit.gpgSign", "false");
        await git.addConfig("user.name", "Llama.vscode history");
        await git.addConfig("user.email", "history@llama.vscode");
    }

    async addChanges(): Promise<void> {
        if (!this.git) throw new Error('Repository not initialized');
        await this.togleDisableGitRepos(true);
        try {
            await this.git.add('.');   
        } catch (error) {
            console.error("Failed to add files to shadow git", error)
            throw error
        } finally {
            await this.togleDisableGitRepos(false);
        }
    }

    async commit(): Promise<string|undefined> {
        try {
			// console.info(`Creating new checkpoint commit for task ${this.taskId}`)
			// const startTime = performance.now()

			// const gitPath = await getShadowGitPath(this.globalStoragePath, this.taskId, this.cwdHash)
			// const git = simpleGit(path.dirname(gitPath))

			// console.info(`Using shadow git at: ${gitPath}`)

			await this.addChanges()

			// const commitMessage = "checkpoint-" + this.cwdHash + "-" + this.taskId
            const commitMessage = (new Date).toISOString();

			console.info(`Creating checkpoint commit with message: ${commitMessage}`)
			const result = await this.git?.commit(commitMessage, {
				"--allow-empty": null,
				"--no-verify": null,
			})
			const commitHash = result?.commit || ""
			console.warn(`Checkpoint commit created.`)

			return commitHash
		} catch (error) {
			console.error("Failed to save state at:", {
				time: (new Date).toISOString(),
				error,
			})
			throw new Error(`Failed to create checkpoint: ${error instanceof Error ? error.message : String(error)}`)
		}
    }

public async togleDisableGitRepos(disable: boolean) {
		try {
		const gitPaths = await globby("**/.git" + (disable ? "" : this.SUFFIX), {
			cwd: this.workspaceRoot,
			onlyDirectories: true,
			ignore: [".git"], // Ignore root level .git
			dot: true,
			markDirectories: false,
		})

		// For each nested .git directory, rename it based on operation
		for (const gitPath of gitPaths) {
			// const fullPath = path.join(this.cwd, gitPath)
			let fullPath = path.join(this.workspaceRoot, gitPath);
            let newPath = disable ? fullPath + this.SUFFIX : fullPath.endsWith(this.SUFFIX) ? fullPath.slice(0, -this.SUFFIX.length) : fullPath
			try {
				await fs.promises.rename(fullPath, newPath)
				console.log(`${disable ? "disabled" : "enabled"} git repo ${fullPath}`)
			} catch (error) {
				console.error(`Failed to ${disable ? "disable" : "enable"} git repo ${fullPath}:`, error)
			}
		}
        }catch(error){
            console.error(error)
        }
	}

    async getHistory(limit: number = 5): Promise<CommitInfo[]> {
        if (!this.git) throw new Error('Repository not initialized');
        const log: LogResult<DefaultLogFields> = await this.git.log({ maxCount: limit });
        return log.all.map(commit => ({
            hash: commit.hash,
            message: commit.message,
            date: commit.date,
            author: commit.author_name
        }));
    }

    async restoreToCommit(commitHash: string): Promise<void> {
        if (!this.git) throw new Error('Repository not initialized');
        await this.git.reset(['--hard', commitHash]);
    }

async hasChangesToCommit(): Promise<boolean> {
        const status: StatusResult|undefined = await this.git?.status();
        
        if(status){
            return (
                status.not_added.length > 0 ||    // Untracked files
                status.created.length > 0 ||       // New files
                status.deleted.length > 0 ||       // Deleted files
                status.modified.length > 0 ||      // Modified files
                status.renamed.length > 0 ||       // Renamed files
                status.staged.length > 0           // Staged changes
            );
        }
        else return false;
    }

    /**
     * Returns the default list of file and directory patterns to exclude from checkpoints.
     * Combines built-in patterns with workspace-specific LFS patterns.
     *
     * @param lfsPatterns - Optional array of Git LFS patterns from workspace
     * @returns Array of glob patterns to exclude
     * @todo Make this configurable by the user
     */
    getExclusions = (lfsPatterns: string[] = []): string[] => [
        // Build and Development Artifacts
        ".git/",
        `${this.SHADOW_DIR}${this.SUFFIX}/`,
        // Buld artifacts
        ".gradle/",".idea/",".parcel-cache/",".pytest_cache/",".next/",".nuxt/",".sass-cache/",".vs/",".vscode/","Pods/","__pycache__/","bin/","build/",
        "bundle/","coverage/","deps/","dist/","env/","node_modules/","obj/","out/","pkg/","pycache/","target/dependency/","temp/","vendor/","venv/",
        // Media Files
        "*.jpg","*.jpeg","*.png","*.gif","*.bmp","*.ico","*.webp","*.tiff","*.tif","*.raw","*.heic","*.avif","*.eps","*.psd","*.3gp","*.aac","*.aiff",
        "*.asf","*.avi","*.divx","*.flac","*.m4a","*.m4v","*.mkv","*.mov","*.mp3","*.mp4","*.mpeg","*.mpg","*.ogg","*.opus","*.rm","*.rmvb","*.vob",
        "*.wav","*.webm","*.wma","*.wmv",
        // Cache and Temporary Files
        "*.DS_Store","*.bak","*.cache","*.crdownload","*.dmp","*.dump","*.eslintcache","*.lock","*.log","*.old","*.part","*.partial","*.pyc","*.pyo",
        "*.stackdump","*.swo","*.swp","*.temp","*.tmp","*.Thumbs.db",
        // Environment and Config Files
        "*.env*", "*.local", "*.development", "*.production",
        // Large Data Files
        "*.zip","*.tar","*.gz","*.rar","*.7z","*.iso","*.bin","*.exe","*.dll","*.so","*.dylib","*.dat","*.dmg","*.msi",
        // Database Files
        "*.arrow","*.accdb","*.aof","*.avro","*.bak","*.bson","*.csv","*.db","*.dbf","*.dmp","*.frm","*.ibd","*.mdb","*.myd","*.myi","*.orc",
        "*.parquet","*.pdb","*.rdb","*.sql","*.sqlite",
        // Geospatial Datasets
        "*.shp","*.shx","*.dbf","*.prj","*.sbn","*.sbx","*.shp.xml","*.cpg","*.gdb","*.mdb","*.gpkg","*.kml","*.kmz","*.gml","*.geojson","*.dem",
        "*.asc","*.img","*.ecw","*.las","*.laz","*.mxd","*.qgs","*.grd","*.csv","*.dwg","*.dxf",
        // Log Files
        "*.error", "*.log", "*.logs", "*.npm-debug.log*", "*.out", "*.stdout", "yarn-debug.log*", "yarn-error.log*",
        // lfs
        ...lfsPatterns,
    ]

    updateExcludesFile = async (gitPath: string): Promise<void> => {
        const excludesPath = path.join(gitPath, "info", "exclude")
        await fs.promises.mkdir(path.join(gitPath, "info"), { recursive: true })

        const patterns = this.getExclusions(await this.getLfsPatterns())
        await fs.promises.writeFile(excludesPath, patterns.join("\n"))
    }

    getLfsPatterns = async (): Promise<string[]> => {
        try {
            const attributesPath = path.join(this.workspaceRoot, ".gitattributes")
            if (await Utils.fileOrDirExists(attributesPath)) {
                const attributesContent = await fs.promises.readFile(attributesPath, "utf8")
                return attributesContent
                    .split("\n")
                    .filter((line) => line.includes("filter=lfs"))
                    .map((line) => line.split(" ")[0].trim())
            }
        } catch (error) {
            console.warn("Failed to read .gitattributes:", error)
        }
        return []
    }

    public async getDiffSet(
		lhsHash: string,
		rhsHash?: string,
	): Promise<
		Array<{
			relativePath: string
			absolutePath: string
			before: string
			after: string
		}>
	> {
		console.info(`Getting diff between commits: ${lhsHash || "initial"} -> ${rhsHash || "working directory"}`)

		// Stage all changes so that untracked files appear in diff summary
		await this.addChanges();

		const diffRange = rhsHash ? `${lhsHash}..${rhsHash}` : lhsHash
		console.info(`Diff range: ${diffRange}`)
		const diffSummary = await this.git?.diffSummary([diffRange])
        if (diffSummary == undefined) return [];

		const result = []
        
		for (const file of diffSummary.files) {
			const filePath = file.file
			const absolutePath = path.join(this.workspaceRoot, filePath)

			let beforeContent = ""
			try {
				beforeContent = await this.git?.show([`${lhsHash}:${filePath}`])??""
			} catch (_) {
				// file didn't exist in older commit => remains empty
			}

			let afterContent = ""
			if (rhsHash) {
				try {
					afterContent = await this.git?.show([`${rhsHash}:${filePath}`])??""
				} catch (_) {
					// file didn't exist in newer commit => remains empty
				}
			} else {
				try {
					afterContent = await fs.promises.readFile(absolutePath, "utf8")
				} catch (_) {
					// file might be deleted => remains empty
				}
			}

			result.push({
				relativePath: filePath,
				absolutePath,
				before: beforeContent,
				after: afterContent,
			})
		}

		return result
	}
}

export interface CommitInfo {
    hash: string;
    message: string;
    date: string;
    author: string;
}
