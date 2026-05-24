import { buildAlerts } from "./alert.ts";
import { buildAuditEvent } from "./audit.ts";
import { deterministicUuid } from "./idempotency.ts";
import { normalizeSignals } from "./normalize.ts";
import type {
  AuditEventDraft,
  IngestionPlan,
  NormalizedSignal,
  OntologyLinkDraft,
  OntologyObjectDraft,
  RawSignal,
  SourceRef
} from "./types.ts";

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", "").replaceAll("$", ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function objectDraft(input: {
  objectType: string;
  key: string;
  attributes: Record<string, unknown>;
  sourceRefs: SourceRef[];
}): OntologyObjectDraft {
  return {
    id: deterministicUuid(`ontology_object:${input.objectType}`, input.key),
    objectType: input.objectType,
    attributes: input.attributes,
    orgVisible: null,
    sourceRefs: input.sourceRefs
  };
}

function linkDraft(input: {
  fromObjectId: string;
  toObjectId: string;
  linkType: string;
  confidence: number;
  sourceRefs: SourceRef[];
}): OntologyLinkDraft {
  return {
    id: deterministicUuid("ontology_link", {
      from: input.fromObjectId,
      to: input.toObjectId,
      type: input.linkType
    }),
    fromObjectId: input.fromObjectId,
    toObjectId: input.toObjectId,
    linkType: input.linkType,
    confidence: input.confidence,
    orgVisible: null,
    sourceRefs: input.sourceRefs
  };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function inferAssetType(description: string | undefined) {
  const normalized = description?.toLowerCase() ?? "";
  if (normalized.includes("data center") || normalized.includes("datacenter")) return "data_center";
  if (normalized.includes("fab") || normalized.includes("semiconductor")) return "fab";
  if (normalized.includes("substation")) return "substation";
  if (normalized.includes("port")) return "port";
  if (normalized.includes("mine")) return "mine";
  if (normalized.includes("power plant") || normalized.includes("generation")) return "power_plant";
  return "factory";
}

function ontologizeSecSignal(signal: NormalizedSignal) {
  const companyName = text(signal.payload.companyName) ?? text(signal.payload.name) ?? "Unknown SEC filer";
  const cik = text(signal.payload.cik) ?? "unknown-cik";
  const form = text(signal.payload.form) ?? "sec_filing";
  const accessionNumber = text(signal.payload.accessionNumber) ?? signal.externalId;
  const objects: OntologyObjectDraft[] = [];
  const links: OntologyLinkDraft[] = [];

  const decisionMaker = objectDraft({
    objectType: "decision_maker",
    key: `sec:${cik}:${companyName}`,
    attributes: {
      name: companyName,
      type: "corporation",
      ticker: text(signal.payload.ticker),
      reality_score: 0
    },
    sourceRefs: signal.sourceRefs
  });
  objects.push(decisionMaker);

  const filing = objectDraft({
    objectType: "permit_filing",
    key: `sec:${accessionNumber}`,
    attributes: {
      source: form === "S-1" ? "sec_s1" : "sec_8k",
      jurisdiction: "US SEC",
      applicant_raw: companyName,
      filing_date: text(signal.payload.filingDate) ?? signal.observedAt.slice(0, 10),
      status: "submitted",
      document_url: signal.sourceRefs[0]?.url
    },
    sourceRefs: signal.sourceRefs
  });
  objects.push(filing);
  links.push(
    linkDraft({
      fromObjectId: decisionMaker.id,
      toObjectId: filing.id,
      linkType: "filed_as",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    })
  );

  const amountUsd = numberValue(signal.payload.amountUsd);
  const commitmentType = text(signal.payload.commitmentType);
  if (amountUsd || commitmentType) {
    const commitment = objectDraft({
      objectType: "capital_commitment",
      key: `sec:commitment:${accessionNumber}`,
      attributes: {
        amount_usd: amountUsd ?? null,
        type: commitmentType ?? "contract",
        execution_date: text(signal.payload.reportDate) ?? text(signal.payload.filingDate) ?? null,
        irrevocability_score: 0.55,
        status: "filed"
      },
      sourceRefs: signal.sourceRefs
    });
    objects.push(commitment);
    links.push(
      linkDraft({
        fromObjectId: decisionMaker.id,
        toObjectId: commitment.id,
        linkType: "commits_capital_to",
        confidence: signal.confidence,
        sourceRefs: signal.sourceRefs
      })
    );
  }

  return { objects, links };
}

function ontologizeFercSignal(signal: NormalizedSignal) {
  const applicant = text(signal.payload.applicantRaw) ?? text(signal.payload.applicant) ?? "Unknown FERC applicant";
  const docketNumber = text(signal.payload.docketNumber) ?? signal.externalId;
  const capacityMw = numberValue(signal.payload.capacityMw);
  const projectName = text(signal.payload.projectName) ?? text(signal.payload.title) ?? docketNumber;
  const objects: OntologyObjectDraft[] = [];
  const links: OntologyLinkDraft[] = [];

  const decisionMaker = objectDraft({
    objectType: "decision_maker",
    key: `ferc:applicant:${applicant}`,
    attributes: {
      name: applicant,
      type: "utility",
      reality_score: 0
    },
    sourceRefs: signal.sourceRefs
  });
  const filing = objectDraft({
    objectType: "permit_filing",
    key: `ferc:docket:${docketNumber}`,
    attributes: {
      source: "ferc",
      jurisdiction: "FERC",
      applicant_raw: applicant,
      filing_date: text(signal.payload.filingDate) ?? signal.observedAt.slice(0, 10),
      status: "submitted",
      document_url: signal.sourceRefs[0]?.url
    },
    sourceRefs: signal.sourceRefs
  });
  const commitment = objectDraft({
    objectType: "capital_commitment",
    key: `ferc:commitment:${docketNumber}`,
    attributes: {
      amount_usd: numberValue(signal.payload.amountUsd) ?? null,
      type: text(signal.payload.commitmentType) ?? "ppa",
      execution_date: text(signal.payload.filingDate) ?? null,
      irrevocability_score: 0.7,
      status: "filed",
      capacity_mw: capacityMw ?? null
    },
    sourceRefs: signal.sourceRefs
  });
  const asset = objectDraft({
    objectType: "physical_asset",
    key: `ferc:asset:${projectName}`,
    attributes: {
      type: inferAssetType(text(signal.payload.description) ?? projectName),
      capacity_value: capacityMw ?? null,
      capacity_unit: capacityMw ? "MW" : null,
      status: "planned",
      name: projectName
    },
    sourceRefs: signal.sourceRefs
  });

  objects.push(decisionMaker, filing, commitment, asset);
  links.push(
    linkDraft({
      fromObjectId: decisionMaker.id,
      toObjectId: filing.id,
      linkType: "filed_as",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    }),
    linkDraft({
      fromObjectId: decisionMaker.id,
      toObjectId: commitment.id,
      linkType: "commits_capital_to",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    }),
    linkDraft({
      fromObjectId: asset.id,
      toObjectId: commitment.id,
      linkType: "requires_power_of",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    })
  );
  return { objects, links };
}

function ontologizeBuildingPermitSignal(signal: NormalizedSignal) {
  const applicant = text(signal.payload.applicantRaw) ?? text(signal.payload.ownerName) ?? "Unknown permit applicant";
  const permitNumber = text(signal.payload.permitNumber) ?? signal.externalId;
  const description = text(signal.payload.description) ?? text(signal.payload.workClass);
  const objects: OntologyObjectDraft[] = [];
  const links: OntologyLinkDraft[] = [];

  const decisionMaker = objectDraft({
    objectType: "decision_maker",
    key: `permit:applicant:${applicant}`,
    attributes: {
      name: applicant,
      type: applicant.toLowerCase().includes("llc") ? "spv" : "corporation",
      shell_probability: applicant.toLowerCase().includes("llc") ? 0.55 : 0.1,
      reality_score: 0
    },
    sourceRefs: signal.sourceRefs
  });
  const filing = objectDraft({
    objectType: "permit_filing",
    key: `building_permit:${permitNumber}`,
    attributes: {
      source: "building_permit",
      jurisdiction: text(signal.payload.jurisdiction) ?? "US local",
      applicant_raw: applicant,
      filing_date: text(signal.payload.issuedAt) ?? text(signal.payload.filingDate) ?? signal.observedAt.slice(0, 10),
      status: text(signal.payload.status) ?? "submitted",
      document_url: signal.sourceRefs[0]?.url
    },
    sourceRefs: signal.sourceRefs
  });
  const asset = objectDraft({
    objectType: "physical_asset",
    key: `building_permit:asset:${permitNumber}`,
    attributes: {
      type: inferAssetType(description),
      status: "permitted",
      capacity_value: numberValue(signal.payload.capacityValue) ?? null,
      capacity_unit: text(signal.payload.capacityUnit) ?? null,
      description: description ?? null
    },
    sourceRefs: signal.sourceRefs
  });

  objects.push(decisionMaker, filing, asset);
  links.push(
    linkDraft({
      fromObjectId: decisionMaker.id,
      toObjectId: filing.id,
      linkType: "filed_as",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    }),
    linkDraft({
      fromObjectId: filing.id,
      toObjectId: asset.id,
      linkType: "precedes_announcement_by",
      confidence: Math.max(0.4, signal.confidence - 0.1),
      sourceRefs: signal.sourceRefs
    })
  );

  const lat = numberValue(signal.payload.lat);
  const lng = numberValue(signal.payload.lng);
  if (lat !== undefined && lng !== undefined) {
    const location = objectDraft({
      objectType: "geo_location",
      key: `geo:${lat}:${lng}:${text(signal.payload.address) ?? permitNumber}`,
      attributes: {
        lat,
        lng,
        name: text(signal.payload.address) ?? text(signal.payload.jurisdiction) ?? "Permit location",
        jurisdiction: text(signal.payload.jurisdiction) ?? "US local",
        scale_level: "parcel"
      },
      sourceRefs: signal.sourceRefs
    });
    objects.push(location);
    links.push(
      linkDraft({
        fromObjectId: asset.id,
        toObjectId: location.id,
        linkType: "located_at",
        confidence: signal.confidence,
        sourceRefs: signal.sourceRefs
      })
    );
  }

  return { objects, links };
}

function maybeLocation(signal: NormalizedSignal, keyPrefix: string, sourceKey: string) {
  const lat = numberValue(signal.payload.lat);
  const lng = numberValue(signal.payload.lng);
  if (lat === undefined || lng === undefined) return undefined;
  return objectDraft({
    objectType: "geo_location",
    key: `${keyPrefix}:geo:${lat}:${lng}:${sourceKey}`,
    attributes: {
      lat,
      lng,
      name: text(signal.payload.location) ?? text(signal.payload.address) ?? text(signal.payload.portName) ?? sourceKey,
      jurisdiction: text(signal.payload.jurisdiction) ?? text(signal.payload.country) ?? "unknown",
      scale_level: "city"
    },
    sourceRefs: signal.sourceRefs
  });
}

function ontologizeCloudRegionSignal(signal: NormalizedSignal) {
  const provider = text(signal.payload.provider) ?? "Unknown cloud provider";
  const regionName = text(signal.payload.regionName) ?? signal.externalId;
  const objects: OntologyObjectDraft[] = [];
  const links: OntologyLinkDraft[] = [];

  const decisionMaker = objectDraft({
    objectType: "decision_maker",
    key: `cloud:provider:${provider}`,
    attributes: {
      name: provider,
      type: "corporation",
      reality_score: 0
    },
    sourceRefs: signal.sourceRefs
  });
  const commitment = objectDraft({
    objectType: "capital_commitment",
    key: `cloud:commitment:${provider}:${regionName}`,
    attributes: {
      amount_usd: numberValue(signal.payload.amountUsd) ?? null,
      type: "capex",
      execution_date: signal.observedAt.slice(0, 10),
      irrevocability_score: 0.5,
      status: text(signal.payload.status) === "operational" ? "operational" : "filed"
    },
    sourceRefs: signal.sourceRefs
  });
  const asset = objectDraft({
    objectType: "physical_asset",
    key: `cloud:region:${provider}:${regionName}`,
    attributes: {
      type: "data_center",
      name: regionName,
      status: text(signal.payload.status) === "operational" ? "operational" : "planned"
    },
    sourceRefs: signal.sourceRefs
  });

  objects.push(decisionMaker, commitment, asset);
  links.push(
    linkDraft({
      fromObjectId: decisionMaker.id,
      toObjectId: commitment.id,
      linkType: "commits_capital_to",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    }),
    linkDraft({
      fromObjectId: commitment.id,
      toObjectId: asset.id,
      linkType: "funds",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    })
  );

  const location = maybeLocation(signal, "cloud", `${provider}:${regionName}`);
  if (location) {
    objects.push(location);
    links.push(
      linkDraft({
        fromObjectId: asset.id,
        toObjectId: location.id,
        linkType: "located_at",
        confidence: signal.confidence,
        sourceRefs: signal.sourceRefs
      })
    );
  }

  return { objects, links };
}

function ontologizeWaterSignal(signal: NormalizedSignal) {
  const applicant = text(signal.payload.applicantRaw) ?? "Unknown water applicant";
  const permitNumber = text(signal.payload.permitNumber) ?? signal.externalId;
  const objects: OntologyObjectDraft[] = [];
  const links: OntologyLinkDraft[] = [];

  const decisionMaker = objectDraft({
    objectType: "decision_maker",
    key: `water:applicant:${applicant}`,
    attributes: {
      name: applicant,
      type: applicant.toLowerCase().includes("llc") ? "spv" : "corporation",
      reality_score: 0
    },
    sourceRefs: signal.sourceRefs
  });
  const filing = objectDraft({
    objectType: "permit_filing",
    key: `water:permit:${permitNumber}`,
    attributes: {
      source: "water_district",
      jurisdiction: text(signal.payload.jurisdiction) ?? "US water district",
      applicant_raw: applicant,
      filing_date: text(signal.payload.filingDate) ?? signal.observedAt.slice(0, 10),
      status: text(signal.payload.status) ?? "submitted",
      document_url: signal.sourceRefs[0]?.url,
      requested_gpd: numberValue(signal.payload.requestedGpd) ?? null
    },
    sourceRefs: signal.sourceRefs
  });

  objects.push(decisionMaker, filing);
  links.push(
    linkDraft({
      fromObjectId: decisionMaker.id,
      toObjectId: filing.id,
      linkType: "filed_as",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    })
  );

  return { objects, links };
}

function ontologizeRawMaterialsSignal(signal: NormalizedSignal) {
  const mineName = text(signal.payload.mineName) ?? signal.externalId;
  const operator = text(signal.payload.operator) ?? "Unknown mine operator";
  const objects: OntologyObjectDraft[] = [];

  const decisionMaker = objectDraft({
    objectType: "decision_maker",
    key: `materials:operator:${operator}`,
    attributes: {
      name: operator,
      type: "corporation",
      reality_score: 0
    },
    sourceRefs: signal.sourceRefs
  });
  const asset = objectDraft({
    objectType: "physical_asset",
    key: `materials:mine:${mineName}`,
    attributes: {
      type: "mine",
      name: mineName,
      status: "operational",
      commodity: text(signal.payload.commodity),
      production_tonnes: numberValue(signal.payload.productionTonnes) ?? null
    },
    sourceRefs: signal.sourceRefs
  });

  objects.push(decisionMaker, asset);
  return { objects, links: [] };
}

function ontologizeLogisticsSignal(signal: NormalizedSignal) {
  const portName = text(signal.payload.portName) ?? signal.externalId;
  const objects: OntologyObjectDraft[] = [];
  const links: OntologyLinkDraft[] = [];

  const asset = objectDraft({
    objectType: "physical_asset",
    key: `logistics:port:${portName}`,
    attributes: {
      type: "port",
      name: portName,
      status: "operational",
      metric: text(signal.payload.metric),
      volume: numberValue(signal.payload.volume) ?? null,
      volume_unit: text(signal.payload.volumeUnit)
    },
    sourceRefs: signal.sourceRefs
  });
  objects.push(asset);

  const location = maybeLocation(signal, "logistics", portName);
  if (location) {
    objects.push(location);
    links.push(
      linkDraft({
        fromObjectId: asset.id,
        toObjectId: location.id,
        linkType: "located_at",
        confidence: signal.confidence,
        sourceRefs: signal.sourceRefs
      })
    );
  }

  return { objects, links };
}

function ontologizeGenericRealitySignal(signal: NormalizedSignal) {
  const entity =
    text(signal.payload.applicantRaw) ??
    text(signal.payload.company) ??
    text(signal.payload.owner) ??
    text(signal.payload.operator) ??
    text(signal.payload.provider) ??
    "Unknown source entity";
  const descriptor =
    text(signal.payload.projectName) ??
    text(signal.payload.assetName) ??
    text(signal.payload.description) ??
    text(signal.payload.title) ??
    signal.externalId;
  const objects: OntologyObjectDraft[] = [];
  const links: OntologyLinkDraft[] = [];

  const decisionMaker = objectDraft({
    objectType: "decision_maker",
    key: `generic:${signal.source}:entity:${entity}`,
    attributes: {
      name: entity,
      type: entity.toLowerCase().includes("llc") ? "spv" : "corporation",
      reality_score: 0,
      source: signal.source
    },
    sourceRefs: signal.sourceRefs
  });
  objects.push(decisionMaker);

  if (["cash"].includes(signal.layer)) {
    const commitment = objectDraft({
      objectType: "capital_commitment",
      key: `generic:${signal.source}:commitment:${signal.externalId}`,
      attributes: {
        amount_usd: numberValue(signal.payload.amountUsd) ?? null,
        type: text(signal.payload.commitmentType) ?? "commercial_signal",
        execution_date: signal.observedAt.slice(0, 10),
        status: "reported",
        source: signal.source,
        description: descriptor
      },
      sourceRefs: signal.sourceRefs
    });
    objects.push(commitment);
    links.push(
      linkDraft({
        fromObjectId: decisionMaker.id,
        toObjectId: commitment.id,
        linkType: "commits_capital_to",
        confidence: signal.confidence,
        sourceRefs: signal.sourceRefs
      })
    );
    return { objects, links };
  }

  if (["energy", "land", "water"].includes(signal.layer)) {
    const filing = objectDraft({
      objectType: "permit_filing",
      key: `generic:${signal.source}:filing:${signal.externalId}`,
      attributes: {
        source: signal.source,
        jurisdiction: text(signal.payload.jurisdiction) ?? "configured source",
        applicant_raw: entity,
        filing_date: signal.observedAt.slice(0, 10),
        status: text(signal.payload.status) ?? "reported",
        document_url: signal.sourceRefs[0]?.url,
        description: descriptor
      },
      sourceRefs: signal.sourceRefs
    });
    objects.push(filing);
    links.push(
      linkDraft({
        fromObjectId: decisionMaker.id,
        toObjectId: filing.id,
        linkType: "filed_as",
        confidence: signal.confidence,
        sourceRefs: signal.sourceRefs
      })
    );
    return { objects, links };
  }

  const asset = objectDraft({
    objectType: "physical_asset",
    key: `generic:${signal.source}:asset:${signal.externalId}`,
    attributes: {
      type: inferAssetType(descriptor),
      name: descriptor,
      status: text(signal.payload.status) ?? "reported",
      source: signal.source,
      capacity_value: numberValue(signal.payload.capacityValue) ?? numberValue(signal.payload.capacityMw) ?? null,
      capacity_unit: text(signal.payload.capacityUnit) ?? (numberValue(signal.payload.capacityMw) ? "MW" : null)
    },
    sourceRefs: signal.sourceRefs
  });
  objects.push(asset);
  links.push(
    linkDraft({
      fromObjectId: decisionMaker.id,
      toObjectId: asset.id,
      linkType: "operates",
      confidence: signal.confidence,
      sourceRefs: signal.sourceRefs
    })
  );

  return { objects, links };
}

export function ontologizeSignal(signal: NormalizedSignal) {
  if (signal.source === "sec-edgar") return ontologizeSecSignal(signal);
  if (signal.source === "ferc-elibrary") return ontologizeFercSignal(signal);
  if (signal.source === "county-building-permits") return ontologizeBuildingPermitSignal(signal);
  if (signal.source === "public-cloud-regions") return ontologizeCloudRegionSignal(signal);
  if (signal.source === "water-district-permits") return ontologizeWaterSignal(signal);
  if (signal.source === "usgs-minerals") return ontologizeRawMaterialsSignal(signal);
  if (signal.source === "port-statistics") return ontologizeLogisticsSignal(signal);
  if (signal.layer === "narrative") return { objects: [], links: [] };
  return ontologizeGenericRealitySignal(signal);
}

export function buildIngestionPlan(rawSignals: RawSignal[]): IngestionPlan {
  const rawSignalsNormalized = normalizeSignals(rawSignals);
  const ontologyObjects: OntologyObjectDraft[] = [];
  const ontologyLinks: OntologyLinkDraft[] = [];
  const auditEvents: AuditEventDraft[] = [];

  for (const signal of rawSignalsNormalized) {
    auditEvents.push(
      buildAuditEvent({
        eventType: "raw_signal_ingested",
        actor: "system",
        signal,
        detail: { layer: signal.layer, externalId: signal.externalId }
      })
    );

    const { objects, links } = ontologizeSignal(signal);
    ontologyObjects.push(...objects);
    ontologyLinks.push(...links);

    for (const object of objects) {
      auditEvents.push(
        buildAuditEvent({
          eventType: "ontology_object_upserted",
          actor: "system",
          signal,
          objectId: object.id,
          detail: { objectType: object.objectType }
        })
      );
    }

    for (const link of links) {
      auditEvents.push(
        buildAuditEvent({
          eventType: "ontology_link_upserted",
          actor: "system",
          signal,
          objectId: link.id,
          detail: { linkType: link.linkType, fromObjectId: link.fromObjectId, toObjectId: link.toObjectId },
          confidence: link.confidence
        })
      );
    }
  }

  const uniqueObjects = uniqueById(ontologyObjects);
  const uniqueLinks = uniqueById(ontologyLinks);
  const alerts = buildAlerts(rawSignalsNormalized, uniqueObjects);

  for (const alert of alerts) {
    const signal = rawSignalsNormalized.find((candidate) => candidate.fingerprint === alert.signalFingerprint);
    if (!signal) continue;
    auditEvents.push(
      buildAuditEvent({
        eventType: "alert_created",
        actor: "system",
        signal,
        objectId: alert.id,
        detail: { priority: alert.priority, title: alert.title },
        confidence: alert.confidence,
        sourceRefs: alert.evidence
      })
    );
  }

  return {
    rawSignals: rawSignalsNormalized,
    ontologyObjects: uniqueObjects,
    ontologyLinks: uniqueLinks,
    alerts,
    auditEvents: uniqueById(auditEvents)
  };
}
