export interface QuoteRushPropertyInputs {
  yearBuilt?: number;
  roofYear?: number;
  yearIdx?: number;
  roofIdx?: number;
  constIdx: number;
  windIdx: number;
  openingProtection?: boolean;
  secondaryWaterResistance?: "Yes" | "No" | "Unknown";
  roofShape?: "Hip" | "Flat" | "Gable";
}

export function resolveQuoteRushPropertyInputs(
  inputs: QuoteRushPropertyInputs,
  currentYear = new Date().getFullYear(),
) {
  const yearMap = [2015, 1995, 1980, 1960];
  const roofYearMap = [
    currentYear - 2,
    currentYear - 8,
    currentYear - 17,
    currentYear - 22,
  ];

  const construction =
    inputs.constIdx === 0
      ? {
          constructionType: "Masonry",
          masonryConstruction: "Concrete Block",
          frameConstruction: "",
        }
      : inputs.constIdx === 2
        ? {
            constructionType: "Frame",
            masonryConstruction: "",
            // Stucco is an exterior finish, not a structural framing type.
            // Leave the QuoteRUSH subtype blank until a verified value exists.
            frameConstruction: "",
          }
        : {
            constructionType: "Mixed",
            masonryConstruction: "Concrete Block",
            frameConstruction: "",
          };

  const wind =
    inputs.windIdx === 0
      ? {
          windMitForm: false,
          openingProtection: "None",
          secondaryWaterResistance: "No",
        }
      : inputs.windIdx === 2
        ? {
            windMitForm: true,
            openingProtection: "Hurricane Protection",
            secondaryWaterResistance: "Yes",
          }
        : {
            windMitForm: true,
            openingProtection: "Basic",
            secondaryWaterResistance: "No",
          };

  return {
    yearBuilt: inputs.yearBuilt ?? yearMap[inputs.yearIdx ?? 1] ?? 1995,
    roofYear:
      inputs.roofYear ?? roofYearMap[inputs.roofIdx ?? 1] ?? currentYear - 8,
    ...construction,
    ...wind,
    ...(inputs.openingProtection !== undefined
      ? {
          openingProtection: inputs.openingProtection
            ? "Hurricane Protection"
            : "None",
        }
      : {}),
    ...(inputs.secondaryWaterResistance
      ? { secondaryWaterResistance: inputs.secondaryWaterResistance }
      : {}),
    roofShape: inputs.roofShape ?? "Gable",
  };
}