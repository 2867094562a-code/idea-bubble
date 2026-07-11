import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Project } from "@/lib/domain";

interface IdeaBubbleDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { "by-updated": string };
  };
}

export interface ProjectRepository {
  get(id: string): Promise<Project | undefined>;
  getLatest(): Promise<Project | undefined>;
  list(): Promise<Project[]>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}

class IndexedDBProjectRepository implements ProjectRepository {
  private databasePromise: Promise<IDBPDatabase<IdeaBubbleDB>> | null = null;

  private getDatabase() {
    if (typeof indexedDB === "undefined") {
      throw new Error("当前环境不支持 IndexedDB");
    }
    if (!this.databasePromise) {
      this.databasePromise = openDB<IdeaBubbleDB>("idea-bubble", 1, {
        upgrade(database) {
          const store = database.createObjectStore("projects", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
        },
      });
    }
    return this.databasePromise;
  }

  async get(id: string) {
    return (await this.getDatabase()).get("projects", id);
  }

  async getLatest() {
    const projects = await this.list();
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async list() {
    return (await this.getDatabase()).getAll("projects");
  }

  async save(project: Project) {
    await (await this.getDatabase()).put("projects", structuredClone(project));
  }

  async delete(id: string) {
    await (await this.getDatabase()).delete("projects", id);
  }
}

export const projectRepository: ProjectRepository = new IndexedDBProjectRepository();

const THRESHOLD_KEY = "idea-bubble:collection-threshold";

export function readCollectionThreshold(fallback = 5) {
  if (typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(THRESHOLD_KEY));
  return Number.isInteger(value) && value >= 3 && value <= 10 ? value : fallback;
}

export function writeCollectionThreshold(value: number) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THRESHOLD_KEY, String(value));
  }
}
