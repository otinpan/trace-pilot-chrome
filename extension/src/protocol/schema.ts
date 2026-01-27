import { string, z } from "zod";

export const CodeBlockSchema=z.object({
    code: z.string(),
    codeRef: z.string().optional(),
    copied: z.boolean(),
    surroundingText: z.string(),
    language: z.string(),
    parentId: z.string(),
    turnParentId: z.string(),
});

export const ThreadPairSchema=z.object({
    id: z.string(),
    time: z.number(),
    userMessage: z.string(),
    botResponse: z.string(),
    codeBlocks: z.array(CodeBlockSchema),
});

export const GPTDataSchema=z.object({
    thread_pair: ThreadPairSchema,
});

export const PDFDataSchema=z.object({});

export const ChromePdfMessageSchema=z.object({
    type: z.literal("CHROME_PDF"),
    url: z.string(),
    plain_text: z.string(),
    data: PDFDataSchema,
});

export const ChatGptMessageSchema=z.object({
    type: z.literal("CHAT_GPT"),
    url: z.string(),
    plain_text: z.string(),
    data: GPTDataSchema,
});


export const OtherMessageSchema=z.object({
    type: z.literal("OTHER"),
    url: z.string(),
    plain_text: z.string(),
    data: z.any().nullable().optional(),
});

export const MessageToNativeHostSchema=z.union([
    ChromePdfMessageSchema,
    ChatGptMessageSchema,
    OtherMessageSchema,
]);