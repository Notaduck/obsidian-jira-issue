jest.mock("obsidian");
jest.mock("../src/main", () => {
  return {
    ObsidianApp: {
      vault: {
        getConfig: jest.fn(),
        getMarkdownFiles: jest.fn((): any[] => []),
      },
    },
  };
});
jest.mock("../src/settings", () => {
  return {
    SettingsData: {
      colorSchema: null as any,
    },
  };
});
jest.mock("../src/rendering/renderingCommon", () => ({
  __esModule: true,
  default: {
    issueUrl: jest.fn(
      (account: any, key: any) => `${account.host}/browse/${key}`
    ),
    getNotes: jest.fn((): any[] => []),
    getTheme: jest.fn(() => "is-light"),
    getFrontMatter: jest.fn(() => ({})),
  },
  JIRA_STATUS_COLOR_MAP: {},
  JIRA_STATUS_COLOR_MAP_BY_NAME: {},
}));
jest.mock("../src/objectsCache", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    add: jest.fn(),
  },
}));
jest.mock("../src/client/jiraClient", () => ({
  __esModule: true,
  default: {
    getDevStatus: jest.fn(),
  },
}));

import { renderTableColumn } from '../src/rendering/renderTableColumns'
import { ESearchColumnsTypes } from '../src/interfaces/settingsInterfaces'
import { IJiraIssue } from '../src/interfaces/issueInterfaces'
import RC from '../src/rendering/renderingCommon'
import { TFile } from 'obsidian'

// We need to import createNoteLink function to test it directly
// Since it's not exported, we'll test it through the main function

// Mock createEl globally since it's used throughout the function
const mockCreateEl = jest.fn((tag, options) => {
  const element = {
    appendChild: jest.fn(),
    appendText: jest.fn(),
    setText: jest.fn(),
    setAttr: jest.fn(),
    href: options?.href,
    text: options?.text,
    title: options?.title,
    cls: options?.cls,
    parent: options?.parent,
  };
  if (options?.parent) {
    options.parent.appendChild(element);
  }
  return element;
});

const mockCreateSpan = jest.fn((options) => {
  return mockCreateEl("span", options);
});

// @ts-ignore
global.createEl = mockCreateEl;
// @ts-ignore
global.createSpan = mockCreateSpan;

describe("renderTableColumn", () => {
  let mockRow: HTMLTableRowElement;
  let mockIssue: IJiraIssue;

  beforeEach(() => {
    mockRow = {
      appendChild: jest.fn(),
    } as any;

    mockIssue = {
      key: "TEST-123",
      id: "12345",
      account: {
        host: "https://mycompany.atlassian.net",
        cache: {
          customFieldsNameToId: {},
          customFieldsIdToName: {},
        },
      },
      fields: {
        summary: "Test issue summary",
        description: "Test description",
        status: {
          name: "In Progress",
          description: "Work in progress",
          statusCategory: {
            colorName: "blue",
          },
        },
        issuetype: {
          name: "Bug",
          iconUrl: "http://example.com/bug.png",
        },
        priority: {
          name: "High",
          iconUrl: "http://example.com/high.png",
        },
        project: {
          key: "TEST",
          name: "Test Project",
        },
        reporter: {
          displayName: "John Doe",
          avatarUrls: {
            "16x16": "http://example.com/avatar.png",
          },
        },
        assignee: {
          displayName: "Jane Smith",
          avatarUrls: {
            "16x16": "http://example.com/avatar2.png",
          },
        },
        created: "2023-01-01T12:00:00.000Z",
        updated: "2023-01-02T12:00:00.000Z",
        duedate: "2023-01-15T12:00:00.000Z",
        resolution: {
          name: "Fixed",
          description: "Issue was resolved",
        },
        resolutiondate: "2023-01-10T12:00:00.000Z",
        environment: "Production",
        labels: ["urgent", "bug"],
        fixVersions: [
          { name: "1.0.0", description: "First release", released: true },
        ],
        components: [{ name: "UI" }, { name: "Backend" }],
        aggregatetimeestimate: 3600,
        aggregatetimeoriginalestimate: 7200,
        aggregatetimespent: 1800,
        timeestimate: 1800,
        timeoriginalestimate: 3600,
        timespent: 900,
        aggregateprogress: { percent: 50 },
        progress: { percent: 75 },
        lastViewed: "2023-01-03T12:00:00.000Z",
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("NOTES column", () => {
    beforeEach(() => {
      // Mock RC.getNotes to return no matching notes
      (RC.getNotes as jest.Mock).mockReturnValue([]);
    });

    test("should create plus button with JIRA folder prefix when no notes exist", async () => {
      const columns = [{ type: ESearchColumnsTypes.NOTES, compact: false }];

      await renderTableColumn(columns, mockIssue, mockRow);

      // Verify that createEl was called to create the plus button
      expect(mockCreateEl).toHaveBeenCalledWith("td", { parent: mockRow });
      expect(mockCreateEl).toHaveBeenCalledWith("a", {
        text: "➕",
        title: "Create new note",
        href: "JIRA/Test Project/TEST-123",
        cls: "internal-link icon-link",
        parent: expect.any(Object),
      });
    });

    test("should create plus button with correct issue key in JIRA folder", async () => {
      const customIssue = { ...mockIssue, key: "PROJ-456" };
      const columns = [{ type: ESearchColumnsTypes.NOTES, compact: false }];

      await renderTableColumn(columns, customIssue, mockRow);

      // Check that the href includes the JIRA folder and correct issue key
      expect(mockCreateEl).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({
          href: "JIRA/Test Project/PROJ-456",
        })
      );
    });

    test("should create plus button with different project folders", async () => {
      const customIssue = { 
        ...mockIssue, 
        key: "PROJ-456",
        fields: {
          ...mockIssue.fields,
          project: {
            key: "PROJ",
            name: "My Custom Project"
          }
        }
      };
      const columns = [{ type: ESearchColumnsTypes.NOTES, compact: false }];

      await renderTableColumn(columns, customIssue, mockRow);

      // Check that the href includes the different project folder
      expect(mockCreateEl).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({
          href: "JIRA/My Custom Project/PROJ-456",
        })
      );
    });

    test("should handle edge cases in createNoteLink", async () => {
      const edgeCaseIssue = { 
        ...mockIssue, 
        key: null as any, // Testing null key
        fields: {
          ...mockIssue.fields,
          project: {
            key: "EDGE",
            name: null as any // Testing null project name
          }
        }
      };
      const columns = [{ type: ESearchColumnsTypes.NOTES, compact: false }];

      await renderTableColumn(columns, edgeCaseIssue, mockRow);

      // Should handle null values gracefully
      expect(mockCreateEl).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({
          href: "JIRA", // Should just be the base folder when values are null
        })
      );
    });

    test("should display existing notes when they exist", async () => {
      // Mock RC.getNotes to return a matching note
      (RC.getNotes as jest.Mock).mockReturnValue([
        {
          name: "TEST-123 some note",
          path: "notes/TEST-123 some note.md",
        },
      ]);

      const columns = [{ type: ESearchColumnsTypes.NOTES, compact: false }];

      await renderTableColumn(columns, mockIssue, mockRow);

      // Should not create plus button when notes exist
      expect(mockCreateEl).not.toHaveBeenCalledWith(
        "a",
        expect.objectContaining({
          text: "➕",
        })
      );

      // Should create link to existing note
      expect(mockCreateEl).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({
          href: "notes/TEST-123 some note.md",
          cls: "internal-link",
        })
      );
    });

    test("should handle compact mode for existing notes", async () => {
      (RC.getNotes as jest.Mock).mockReturnValue([
        {
          name: "TEST-123 some note",
          path: "notes/TEST-123 some note.md",
        },
      ]);

      const columns = [{ type: ESearchColumnsTypes.NOTES, compact: true }];

      await renderTableColumn(columns, mockIssue, mockRow);

      // In compact mode, should show 📝 emoji
      expect(mockCreateEl).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({
          text: "📝",
          href: "notes/TEST-123 some note.md",
        })
      );
    });
  });

  test("should create KEY column with correct link", async () => {
    const columns = [{ type: ESearchColumnsTypes.KEY, compact: false }];

    await renderTableColumn(columns, mockIssue, mockRow);

    expect(mockCreateEl).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({
        href: "https://mycompany.atlassian.net/browse/TEST-123",
        text: "TEST-123",
      })
    );
  });

  test("should create SUMMARY column with correct text", async () => {
    const columns = [{ type: ESearchColumnsTypes.SUMMARY, compact: false }];

    await renderTableColumn(columns, mockIssue, mockRow);

    expect(mockCreateEl).toHaveBeenCalledWith(
      "td",
      expect.objectContaining({
        text: "Test issue summary",
      })
    );
  });
});

export {};
