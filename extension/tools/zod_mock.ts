import { z } from "zod";
import type { ZodTypeAny } from "zod";

export function mockFromSchema<T extends ZodTypeAny>(
  schema: T,
  num: number
): z.output<T> {
  const v = mockFromSchemaImpl(schema, num);
  return v as z.output<T>;
}

function kind(schema: ZodTypeAny): string {
  if (schema instanceof z.ZodUnion) return "union";
  if (schema instanceof z.ZodObject) return "object";
  if (schema instanceof z.ZodLiteral) return "literal";
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  if (schema instanceof z.ZodArray) return "array";
  if (schema instanceof z.ZodOptional) return "optional";
  if (schema instanceof z.ZodNullable) return "nullable";
  return "other";
}


function mockFromSchemaImpl(schema: ZodTypeAny, num: number): unknown {
  if (!schema) throw new Error("schema is undefined");
  if (schema instanceof z.ZodAny) return null;
  if (schema instanceof z.ZodUnknown) return null;
  if (schema instanceof z.ZodNull) return null;


  const def = (schema as any)._def;
  //console.log(kind(schema));

  if (schema instanceof z.ZodString) return "mock_string";
  if (schema instanceof z.ZodNumber) return 1700000000;
  if (schema instanceof z.ZodBoolean) return true;

  if (schema instanceof z.ZodLiteral) {
    const d: any = (schema as any)._def;
    // v3/v4吸収：value が無い場合もある
    return d.value ?? d.values?.[0] ?? d.expected ?? d.literal ?? d?.innerType?._def?.value;
  }

  if (schema instanceof z.ZodEnum) return def.values[0];

  if (schema instanceof z.ZodOptional) return mockFromSchemaImpl(def.innerType, num);
  if (schema instanceof z.ZodNullable) return mockFromSchemaImpl(def.innerType, num);
  if (schema instanceof z.ZodDefault) return mockFromSchemaImpl(def.innerType, num);

  if (schema instanceof z.ZodArray) {
    const elementSchema = (schema as any).element;
    return [mockFromSchemaImpl(elementSchema, num)];
  }

  if (schema instanceof z.ZodObject) {
    // v4で安定：def.shapeよりschema.shapeの方が確実
    const shape = (schema as any).shape;
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      obj[key] = mockFromSchemaImpl(shape[key], num);
    }
    return obj;
  }


  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = def.options instanceof Map ? Array.from(def.options.values()) : def.options;
    const picked = options[Math.max(0, Math.min(num, options.length - 1))];
    return mockFromSchemaImpl(picked, num);
  }

  if (schema instanceof z.ZodUnion) {
    const options = def.options ?? [];
    const picked = options[Math.max(0, Math.min(num, options.length - 1))];
    return mockFromSchemaImpl(picked, num);
  }

  throw new Error("Unsupported schema kind");

}
