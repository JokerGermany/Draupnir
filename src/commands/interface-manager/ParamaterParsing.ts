/**
 * Copyright (C) 2022 Gnuxie <Gnuxie@protonmail.com>
 * All rights reserved.
 *
 * This file incorperates work from mjolnir
 * https://github.com/matrix-org/mjolnir
 * Which includes the following license notice:
 *
Copyright 2022 The Matrix.org Foundation C.I.C.

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
 * are NOT distributed, contributed, or committed under the Apache License.
 */

import { Keyword, ReadItem, SuperCoolStream } from "./CommandReader";
import { ValidationError, ValidationResult } from "./Validation";

class ArgumentStream extends SuperCoolStream<ReadItem[]> {
    
}

type PredicateIsParamater = (readItem: ReadItem) => ValidationResult<true>;

interface DestructableRest {
    rest: ReadItem[],
    // Pisses me off to no end that this is how it has to work.
    [prop: string]: ReadItem|ReadItem[],
}

export class RestParser {
    public parseRest(stream: ArgumentStream): ValidationResult<DestructableRest> {
        const items: ReadItem[] = [];
        while (stream.peekItem()) {
            items.push(stream.readItem());
        }
        return ValidationResult.Ok({ rest: items });
    }
}

// Maybe we can get around the index type restriction by making "rest" a protected keyword?
interface KeywordsDescription {
    readonly [prop: string]: KeywordPropertyDescription|boolean;
    readonly allowOtherKeys: boolean
}

interface KeywordPropertyDescription {
    readonly isFlag: boolean;
    readonly propertyPredicate?: PredicateIsParamater;
    readonly name: string,

}

// Things that are also needed that are not done yet:
// 1) We need to figure out what happens to aliases for keywords..
// 2) We need to sort out the predicates thing.
export class KeywordParser extends RestParser {
    constructor(private readonly description: KeywordsDescription) {
        super();
    }

    /**
     * TODO: Prototype pollution must be part of integration tests for this
     * @param items 
     */
    public parseRest(itemStream: ArgumentStream): ValidationResult<DestructableRest> {
        const destructable: DestructableRest = { rest: [] };
        // Wrong, we can't use position, we need a stream.
        while(itemStream.peekItem() !== undefined) {
            const item = itemStream.readItem();
            if (item instanceof Keyword) {
                const description = this.description[item.designator];
                if (typeof description === 'boolean') {
                    throw new TypeError("Shouldn't be a boolean mate");
                }
                const associatedProperty: ValidationResult<any> = (() => {
                    if (itemStream.peekItem() !== undefined && !(itemStream.peekItem() instanceof Keyword)) {
                        const associatedProperty = itemStream.readItem();
                        return ValidationResult.Ok(associatedProperty);
                    } else {
                        if (!description.isFlag) {
                            return ValidationError.Result('keyword verification failed', `An associated argument was not provided for the keyword ${description.name}.`)
                        }
                        return ValidationResult.Ok(true);
                    }
                })();
                if (associatedProperty.isErr()) {
                    return ValidationResult.Err(associatedProperty.err);
                }
                destructable[description.name] = associatedProperty.ok;

            } else {
                destructable.rest.push(item);
            }
        }
        return ValidationResult.Ok(destructable);
    }
}

export interface ParsedArguments {
    readonly immediateArguments: ReadItem[],
    readonly rest?: DestructableRest,
}

export function paramaters(paramaters: PredicateIsParamater[], restParser: undefined|RestParser = undefined): (...readItems: ReadItem[]) => ValidationResult<ParsedArguments> {
    return (...readItems: ReadItem[]) => {
        const itemStream = new ArgumentStream(readItems);
        for (const paramater of paramaters) {
            if (itemStream.peekItem() === undefined) {
                // FIXME asap: we need a proper paramater description?
                return ValidationError.Result('expected an argument', `An argument for the paramater ${paramater} was expected but was not provided.`);
            }
            const item = itemStream.readItem()!;
            const result = paramater(item);
            if (result.err) {
                return ValidationResult.Err(result.err);
            }
        }
        if (restParser) {
            const result = restParser.parseRest(itemStream);
            if (result.isErr()) {
                return ValidationResult.Err(result.err);
            }
            return ValidationResult.Ok({ immediateArguments: readItems, rest: result.ok });
        } else {
            return ValidationResult.Ok({ immediateArguments: readItems });
        }
    }
}

export function union(...predicates: PredicateIsParamater[]): PredicateIsParamater {
    return (item: ReadItem) => {
        const matches = predicates.map(predicate => predicate(item));
        const oks = matches.filter(result => result.isOk());
        if (oks.length > 0) {
            return ValidationResult.Ok(true);
        } else {
            // FIXME asap: again, we need some context as to what the argument is?
            return ValidationError.Result('invalid paramater', `The argument must match the paramater description ${matches}`);
        }
    }
}
