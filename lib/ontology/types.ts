export type ObjectType =
  | "decision_maker"
  | "capital_commitment"
  | "physical_asset"
  | "permit_filing"
  | "project_codename"
  | "geo_location";

export type OntologyObject = {
  id: string;
  objectType: ObjectType;
  attributes: Record<string, unknown>;
  orgVisible: string | null;
  sourceRefs: string[];
  confidence?: number;
};

export type OntologyLink = {
  id: string;
  fromObjectId: string;
  toObjectId: string;
  linkType: string;
  confidence: number;
  orgVisible: string | null;
  sourceRefs: string[];
};
