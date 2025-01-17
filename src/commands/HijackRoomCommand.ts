/**
 * Copyright (C) 2022 Gnuxie <Gnuxie@protonmail.com>
 * All rights reserved.
 *
 * This file is modified and is NOT licensed under the Apache License.
 * This modified file incorperates work from mjolnir
 * https://github.com/matrix-org/mjolnir
 * which included the following license notice:

Copyright 2021, 2022 Marco Cirillo

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

import { defineInterfaceCommand, findTableCommand } from "./interface-manager/InterfaceCommand";
import { findPresentationType, parameters } from "./interface-manager/ParameterParsing";
import { MjolnirBaseExecutor, MjolnirContext } from "./CommandHandler";
import { MatrixRoomReference } from "./interface-manager/MatrixRoomReference";
import { UserID } from "matrix-bot-sdk";
import { CommandError, CommandResult } from "./interface-manager/Validation";
import { tickCrossRenderer } from "./interface-manager/MatrixHelpRenderer";
import { defineMatrixInterfaceAdaptor } from "./interface-manager/MatrixInterfaceAdaptor";

async function hijackRoomCommand(
    this: MjolnirContext, _keywords: void, room: MatrixRoomReference, user: UserID
): Promise<CommandResult<void, CommandError>> {
    const isAdmin = await this.mjolnir.isSynapseAdmin();
    if (!this.mjolnir.config.admin?.enableMakeRoomAdminCommand || !isAdmin) {
        return CommandError.Result("Either the command is disabled or Mjolnir is not running as homeserver administrator.")
    }
    await this.mjolnir.makeUserRoomAdmin(room.toRoomIdOrAlias(), user.toString());
    return CommandResult.Ok(undefined);
}

defineInterfaceCommand<MjolnirBaseExecutor>({
    designator: ["hijack", "room"],
    table: "mjolnir",
    parameters: parameters([
        {
            name: "room",
            acceptor: findPresentationType("MatrixRoomReference")
        },
        {
            name: "user",
            acceptor: findPresentationType("UserID")
        }
    ]),
    command: hijackRoomCommand,
    summary: "Make the specified user the admin of a room via the synapse admin API"
})

defineMatrixInterfaceAdaptor({
    interfaceCommand: findTableCommand("mjolnir", "hijack", "room"),
    renderer: tickCrossRenderer
})
