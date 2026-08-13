export interface GoogleUser {
  email: string;
  name?: string;
  picture?: string;
  sub?: string;
}

export interface Session {
  sessionToken: string;
  expiresAt: number;
  user: GoogleUser;
}

export interface TextTagPair {
  text: string;
  tag: string;
}

export interface TextNodeEntry {
  node: Text;
  text: string;
}

export interface HighlightRecord {
  id?: number | string;
  text: string;
  tag?: string;
  text_tag_pairs: TextTagPair[];
  startOffset: number;
  endOffset: number;
  color?: string;
  url?: string;
}

export type GetHighlightsMessage = {
  type: "get_highlights";
  url: string;
};

export type UrlChangedMessage = {
  type: "url_changed";
  url: string;
};

export type AddHighlightsMessage = {
  type: "add_highlights";
  url: string;
  text: string;
  tag?: string;
  text_tag_pairs: TextTagPair[];
  startOffset: number;
  endOffset: number;
  color: string;
};

export type ExtensionMessage = GetHighlightsMessage | AddHighlightsMessage;

export type GetHighlightsResponse =
  | { highlights: HighlightRecord[]; error?: undefined }
  | { error: string; highlights?: undefined };

export type AddHighlightsResponse =
  | { highlight: HighlightRecord; error?: undefined }
  | { error: string; highlight?: undefined };
