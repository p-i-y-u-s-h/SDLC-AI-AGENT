export function normalizeRequirementOutput(
    input: any
) {

    const output = {
        ...input,
        constraints: [] as string[],
        technologyConstraints: [
            ...(Array.isArray(input.technologyConstraints)
                ? input.technologyConstraints
                : [])
        ]
    };


    const constraints =
        Array.isArray(input.constraints)
            ? input.constraints
            : [];


    for (const constraint of constraints) {

        if (typeof constraint === "string") {

            output.constraints.push(
                constraint
            );

            continue;
        }


        if (
            constraint
            &&
            typeof constraint === "object"
            &&
            typeof constraint.key === "string"
            &&
            typeof constraint.value === "string"
        ) {

            output.technologyConstraints.push({

                key:
                    constraint.key,

                value:
                    constraint.value,

                locked:
                    constraint.locked !== false

            });

            continue;
        }


        throw new Error(
            "INVALID_REQUIREMENT_CONSTRAINT: constraints must contain strings."
        );
    }


    output.capabilityGroups =
        normalizeCapabilityGroups(
            input.capabilityGroups,
            output.functionalRequirements
        );

    output.technologyConstraints =
        deduplicateTechnologyConstraints(
            output.technologyConstraints
        );

    return output;
}


function normalizeCapabilityGroups(
    rawGroups: any,
    functionalRequirements: any[]
): any[] {
    if (!Array.isArray(rawGroups)) {
        return [];
    }

    const reqIdSet = new Set<string>();
    if (Array.isArray(functionalRequirements)) {
        for (const req of functionalRequirements) {
            if (req && typeof req.id === "string") {
                reqIdSet.add(req.id.trim());
            }
        }
    }

    const groups: any[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < rawGroups.length; i++) {
        const group = rawGroups[i];
        if (!group || typeof group !== "object") continue;

        const id = typeof group.id === "string" && group.id.trim()
            ? group.id.trim()
            : `CAP${String(i + 1).padStart(3, "0")}`;

        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const name = typeof group.name === "string" && group.name.trim()
            ? group.name.trim()
            : `Capability Group ${i + 1}`;

        const description = typeof group.description === "string"
            ? group.description.trim()
            : "";

        const requirementIds: string[] = [];
        if (Array.isArray(group.requirementIds)) {
            for (const rId of group.requirementIds) {
                if (typeof rId === "string" && reqIdSet.has(rId.trim())) {
                    requirementIds.push(rId.trim());
                }
            }
        }

        groups.push({
            id,
            name,
            description,
            requirementIds
        });
    }

    return groups;
}


function deduplicateTechnologyConstraints(
    constraints: any[]
) {

    const result =
        new Map<
            string,
            {
                key: string;
                value: string;
                locked: boolean;
            }
        >();


    for (const constraint of constraints) {

        if (
            !constraint
            ||
            typeof constraint.key !== "string"
            ||
            typeof constraint.value !== "string"
        ) {

            continue;
        }


        const key =
            constraint.key
                .trim()
                .toLowerCase();


        result.set(
            key,
            {
                key:
                    constraint.key.trim(),

                value:
                    constraint.value.trim(),

                locked:
                    constraint.locked !== false
            }
        );
    }


    return [
        ...result.values()
    ];
}