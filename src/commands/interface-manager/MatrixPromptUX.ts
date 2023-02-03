/**
 * Copyright (C) 2023 Gnuxie <Gnuxie@protonmail.com>
 * All rights reserved.
 */

import { MatrixEmitter } from "../../MatrixEmitter";
import { CommandError, CommandResult } from "./Validation";

// Internal to PromptResponseListener and needs to be manually managed
// ie calls to .on and .off, so this is why it's internal

type PresentationByReactionKey = Map<string/*reaction key*/, any/*presentation*/>;

// Returns true if the listener should be kept.
type ReactionPromptListener = (presentation: any) => boolean|void;

// Instead of providing a map of reaciton keys to presentations, should instead
// there be provided an object that can quickly be interned and uninterened from the table
// by testing EQ? It's important to wrap the map if you consider that
// multiple invocations can have seperate listeners but share the same map.
class ReactionPromptRecord {
    constructor(
        public readonly presentationByReaction: PresentationByReactionKey,
        public readonly listener: ReactionPromptListener,
    ) {
        // nothing to do.
    }
}

class ReactionHandler {
    private readonly promptRecordByEvent: Map<string/*event id*/, Set<ReactionPromptRecord>> = new Map();

    constructor(
        matrixEmitter: MatrixEmitter
    ) {
        matrixEmitter.on('room.event', this.handleEvent.bind(this))
    }

    private addPresentationsForEvent(eventId: string, promptRecord: ReactionPromptRecord): void {
        const promptRecords = (() => {
            let entry = this.promptRecordByEvent.get(eventId);
            if (entry === undefined) {
                entry = new Set();
                this.promptRecordByEvent.set(eventId, entry);
            }
            return entry;
        })();
        promptRecords.add(promptRecord);
    }

    private removePromptRecordForEvent(eventId: string, promptRecord: ReactionPromptRecord): void {
        const promptRecords = this.promptRecordByEvent.get(eventId);
        if (promptRecords !== undefined) {
            promptRecords.delete(promptRecord);
            if (promptRecords.size === 0) {
                this.promptRecordByEvent.delete(eventId);
            }
        }
    }

    private handleEvent(roomId: string, event: { event_id: string, type: string, content: any }): void {
        // Horrid, would be nice to have some pattern matchy thingo
        if (event.type !== 'm.reaction') {
            return;
        }
        const relatesTo = event['content']?.['m.relates_to'];
        if (relatesTo === undefined) {
            return;
        }
        if (relatesTo['rel_type'] !== 'm.annotation') {
            return;
        }
        const relatedEventId = relatesTo['event_id'];
        const reactionKey = relatesTo['key'];
        if (!(typeof relatedEventId === 'string' && typeof reactionKey === 'string')) {
            return;
        }
        const entry = this.promptRecordByEvent.get(event.event_id);
        if (entry !== undefined) {
            for (const record of entry) {
                const presentation = record.presentationByReaction.get(reactionKey);
                const keepListener = record.listener(presentation);
                if (!Boolean(keepListener)) {
                    this.removePromptRecordForEvent(event.event_id, record);
                }
            }
        }
    }

    public async waitForReactionToPrompt<T>(
        eventId: string, presentationByReaction: PresentationByReactionKey, timeout = 600_000 // ten minutes
    ): Promise<CommandResult<T, CommandError>> {
        let record;
        const presentationOrTimeout = await Promise.race([
            new Promise(resolve => {
                record = new ReactionPromptRecord(presentationByReaction, resolve);
                this.addPresentationsForEvent(eventId, record);
            }),
            new Promise(resolve => setTimeout(resolve, timeout)),
        ]);
        if (presentationOrTimeout === undefined) {
            if (record !== undefined) {
                this.removePromptRecordForEvent(eventId, record);
            }
            return CommandError.Result(`Timed out while waiting for a response to the prompt`);
        } else {
            return CommandResult.Ok(presentationOrTimeout as T);
        }
    }
}

// How this would work
// Give token to go into event
// Each presentationByKey is stored against the token, not the event.
// Simultaneous:
//  * when a reaction event is sent, we lookup the original event id and find its key
//    if we can't find its key, then what do we do?
//    Either lookup the event via the endpoint or have some way to wait for it
//    to come from the event send promise. Or just wait for the event send promise?
//    I think if the event isn't in the store, then we just have to use the get event endpoint
//    or try again after 10 seconds or something.
//
// * resolve the presentation by looking at the presentationsByKey for that token.
// This is ovbiously complicated as hell, so i think we will just do without for now.


// Shouldn't be a reaciton listener, since it needs to be able to notice reply fallbacks
// like Yes/No and 1. or 2. etc.

// For ban command can we suggest reasons? I think that'd be a good idea.

// Prompt takes priority over presentations e.g. imagine the prompt
// requiring a string, but we give one as a presentation in a reply
// reactions should be checked first before being given to the command.
export class PromptResponseListener {
    private readonly reactionHandler: ReactionHandler;

    constructor(
        matrixEmitter: MatrixEmitter
    ) {
        this.reactionHandler = new ReactionHandler(matrixEmitter);
    }

    private indexToReactionKey(index: number): string {
        if (index < 10) {
            return "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟".charAt(index);
        } else {
            return index.toString();
        }
    }

    // This won't work, we have to have a special key in the original event
    // that means we should be waiting for it, that can't be abused/forged.
    // As we can't have the event id AOT.
    public async waitForPresentationList<T>(presentations: T[], eventPromise: Promise<string>): Promise<CommandResult<T>> {
        const presentationByReactionKey = presentations.reduce(
            (map: PresentationByReactionKey, presentation: T, index: number) => {
                return map.set(this.indexToReactionKey(index), presentation);
            },
            new Map()
        );
        return await this.reactionHandler.waitForReactionToPrompt<T>(await eventPromise, presentationByReactionKey);
    }
}