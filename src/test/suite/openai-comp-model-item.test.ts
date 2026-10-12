/// <reference types="mocha" />
import * as assert from "assert";
import { suite, test } from "mocha";
import { OPENAI_COMP_PROVIDERS, OpenAiProvidersKeys } from "../../constants";
import { formatOpenAiCompModelItem } from "../../services/openai-comp-model-item";

suite("OpenAI-compatible model picker", () => {
    test("registers API Route without a duplicate API version segment", () => {
        assert.strictEqual(OPENAI_COMP_PROVIDERS[OpenAiProvidersKeys.ApiRoute], "https://global.api-route.com");
    });

    test("handles a standard model listing with no optional metadata", () => {
        const item = formatOpenAiCompModelItem({ id: "gpt-6.1-sol" });
        assert.strictEqual(item.label, "gpt-6.1-sol");
        assert.strictEqual(item.detail, "gpt-6.1-sol");
        assert.strictEqual(item.description, "Context and pricing not provided");
    });

    test("preserves rich metadata and string-valued token prices", () => {
        const item = formatOpenAiCompModelItem({
            id: "vendor/model", name: "Model", description: "Model description",
            context_length: "128000", pricing: { prompt: "0.000001", completion: 0 },
        });
        assert.strictEqual(item.label, "Model");
        assert.strictEqual(item.detail, "Model description | vendor/model");
        assert.strictEqual(item.description, "128000 context | $1.00/M input tokens | $0.00/M output tokens");
    });

    test("does not invent missing prices when only input pricing is available", () => {
        const item = formatOpenAiCompModelItem({ id: "model", pricing: { prompt: 0.000002 } });
        assert.strictEqual(item.description, "$2.00/M input tokens");
    });

    test("omits invalid metadata and keeps a fully qualified model ID", () => {
        const item = formatOpenAiCompModelItem({
            id: "vendor/model", name: "", context_length: -1,
            pricing: { prompt: "unknown", completion: " " },
        });
        assert.strictEqual(item.label, "vendor/model");
        assert.strictEqual(item.detail, "vendor/model");
        assert.strictEqual(item.description, "Context and pricing not provided");
    });
});
