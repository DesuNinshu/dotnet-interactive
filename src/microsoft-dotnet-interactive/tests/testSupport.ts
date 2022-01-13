// Copyright (c) .NET Foundation and contributors. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as contracts from "../src/contracts";
import { TokenGenerator } from "../src/tokenGenerator";
import { CommandAndEventReceiver, GenericTransport } from "../src/genericTransport";

export function findEvent<T>(kernelEventEnvelopes: contracts.KernelEventEnvelope[], eventType: contracts.KernelEventType): T | undefined {
    return findEventEnvelope(kernelEventEnvelopes, eventType)?.event as T;
}

export function findEventFromKernel<T>(kernelEventEnvelopes: contracts.KernelEventEnvelope[], eventType: contracts.KernelEventType, kernelName: string): T | undefined {
    return findEventEnvelopeFromKernel(kernelEventEnvelopes, eventType, kernelName)?.event as T;
}

export function findEventEnvelope(kernelEventEnvelopes: contracts.KernelEventEnvelope[], eventType: contracts.KernelEventType): contracts.KernelEventEnvelope | undefined {
    return kernelEventEnvelopes.find(eventEnvelope => eventEnvelope.eventType === eventType);
}

export function findEventEnvelopeFromKernel(kernelEventEnvelopes: contracts.KernelEventEnvelope[], eventType: contracts.KernelEventType, kernelName: string): contracts.KernelEventEnvelope | undefined {
    return kernelEventEnvelopes.find(eventEnvelope => eventEnvelope.eventType === eventType && eventEnvelope.command!.command.targetKernelName === kernelName);
}

export function createInMemoryTransport(eventProducer?: (commandEnvelope: contracts.KernelCommandEnvelope) => contracts.KernelEventEnvelope[]): { transport: GenericTransport, sentItems: (contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope)[], writeToTransport: (data: (contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope)) => void } {
    let sentItems: (contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope)[] = [];
    if (!eventProducer) {
        eventProducer = (ce) => {
            return [{ eventType: contracts.CommandSucceededType, event: <contracts.CommandSucceeded>{}, command: ce }];
        };
    }

    const receiver = new CommandAndEventReceiver();
    let sender: (message: contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope) => Promise<void> = (item) => {
        sentItems.push(item);
        let events = eventProducer!(<contracts.KernelCommandEnvelope>item);
        for (let event of events) {
            receiver.delegate(event);
        }
        return Promise.resolve();
    };
    let transport = new GenericTransport(
        sender,
        () => {
            return receiver.read();
        }
    );
    return {
        transport,
        sentItems,
        writeToTransport: (data) => {
            receiver.delegate(data);
        }
    };
}

export function createInMemoryChannel(): { channels: { transport: GenericTransport, sentItems: (contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope)[] }[] } {
    const sentItems1: (contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope)[] = [];
    const sentItems2: (contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope)[] = [];
    const receiver1 = new CommandAndEventReceiver();
    const receiver2 = new CommandAndEventReceiver();

    const sender1: (message: contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope) => Promise<void> = (item) => {
        sentItems1.push(item);
        receiver2.delegate(item);
        return Promise.resolve();
    };

    const sender2: (message: contracts.KernelCommandEnvelope | contracts.KernelEventEnvelope) => Promise<void> = (item) => {
        sentItems2.push(item);
        receiver1.delegate(item);
        return Promise.resolve();
    };

    const transport1 = new GenericTransport(
        sender1,
        () => {
            return receiver1.read();
        }
    );

    const transport2 = new GenericTransport(
        sender2,
        () => {
            return receiver2.read();
        }
    );

    return {
        channels: [
            {
                transport: transport1,
                sentItems: sentItems1,
            },
            {
                transport: transport2,
                sentItems: sentItems2,
            }
        ]
    };
}