/**
 * Copyright (C) 2022 Gnuxie <Gnuxie@protonmail.com>
 * All rights reserved.
 *
 * This file is modified and is NOT licensed under the Apache License.
 * This modified file incorperates work from mjolnir
 * https://github.com/matrix-org/mjolnir
 * which included the following license notice:

Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 *
 * However, this file is modified and the modifications in this file
 * are NOT distributed, contributed, committed, or licensed under the Apache License.
 */

import { Mjolnir } from "../Mjolnir";
import { Permalinks, RichReply } from "matrix-bot-sdk";

// !mjolnir watch <room alias or ID>
export async function execWatchCommand(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]) {
    const list = await mjolnir.policyListManager.watchList(Permalinks.forRoom(parts[2]));
    if (!list) {
        const replyText = "Cannot watch list due to error - is that a valid room alias?";
        const reply = RichReply.createFor(roomId, event, replyText, replyText);
        reply["msgtype"] = "m.notice";
        mjolnir.client.sendMessage(roomId, reply);
        return;
    }
    await mjolnir.client.unstableApis.addReactionToEvent(roomId, event['event_id'], '✅');
}

// !mjolnir unwatch <room alias or ID>
export async function execUnwatchCommand(roomId: string, event: any, mjolnir: Mjolnir, parts: string[]) {
    const list = await mjolnir.policyListManager.unwatchList(Permalinks.forRoom(parts[2]));
    if (!list) {
        const replyText = "Cannot unwatch list due to error - is that a valid room alias?";
        const reply = RichReply.createFor(roomId, event, replyText, replyText);
        reply["msgtype"] = "m.notice";
        mjolnir.client.sendMessage(roomId, reply);
        return;
    }
    await mjolnir.client.unstableApis.addReactionToEvent(roomId, event['event_id'], '✅');
}
