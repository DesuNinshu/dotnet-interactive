// Copyright (c) .NET Foundation and contributors. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.DotNet.Interactive.Commands;
using Microsoft.DotNet.Interactive.Events;
using Microsoft.DotNet.Interactive.Tests.Utility;
using Microsoft.Playwright;
using Pocket;
using Pocket.For.Xunit;
using Xunit.Abstractions;

namespace Microsoft.DotNet.Interactive.Browser.Tests;

[LogToPocketLogger(FileNameEnvironmentVariable = "POCKETLOGGER_LOG_PATH")]
public class HtmlKernelTests : IDisposable
{
    private readonly CompositeDisposable _disposables = new();

    public HtmlKernelTests(ITestOutputHelper output)
    {
        _disposables.Add(output.SubscribeToPocketLogger());
    }

    public void Dispose() => _disposables.Dispose();

    [FactSkipLinux]
    public async Task It_can_share_the_underlying_Playwright_page_object()
    {
        using var kernel = await CreateHtmlProxyKernelAsync();

        var result = await kernel.SendAsync(new RequestValue("*", "text/html"));

        var events = result.KernelEvents.ToSubscribedList();

        events
            .Should()
            .ContainSingle<ValueProduced>()
            .Which
            .Value
            .Should()
            .BeAssignableTo<ILocator>();
    }

    [FactSkipLinux]
    public async Task It_can_share_the_underlying_page_HTML()
    {
        using var kernel = await CreateHtmlProxyKernelAsync();

        var setupEvents = await kernel.SubmitCodeAsync("<div>hello</div>");
        setupEvents.KernelEvents.ToSubscribedList().Should().NotContainErrors();

        var result = await kernel.SendAsync(new RequestValue("*", "text/html"));

        var events = result.KernelEvents.ToSubscribedList();

        events
            .Should()
            .ContainSingle<ValueProduced>()
            .Which
            .FormattedValue
            .Value
            .Should()
            .Contain("<div>hello</div>");
    }

    [FactSkipLinux]
    public async Task It_can_share_the_underlying_page_content()
    {
        using var kernel = await CreateHtmlProxyKernelAsync();

        var setupEvents = await kernel.SubmitCodeAsync("<div>hello</div>");
        setupEvents.KernelEvents.ToSubscribedList().Should().NotContainErrors();

        var result = await kernel.SendAsync(new RequestValue(":root", "text/plain"));

        var events = result.KernelEvents.ToSubscribedList();

        events
            .Should()
            .ContainSingle<ValueProduced>()
            .Which
            .FormattedValue
            .Value
            .Should()
            .Be("hello");
    }

    [FactSkipLinux]
    public async Task It_has_shareable_values()
    {
        using var kernel = await CreateHtmlProxyKernelAsync();

        var result = await kernel.SendAsync(new RequestValueInfos());

        var events = result.KernelEvents.ToSubscribedList();

        events
            .Should()
            .ContainSingle<ValueInfosProduced>()
            .Which
            .ValueInfos
            .Should()
            .ContainSingle(i => i.Name == ":root");
    }

    [FactSkipLinux]
    public async Task JavaScript_and_HTML_proxies_have_access_to_the_same_DOM()
    {
        var connector = new PlaywrightKernelConnector();

        using var javascriptKernel = await connector.CreateKernelAsync("javascript");
        using var htmlKernel = await connector.CreateKernelAsync("html");

        await javascriptKernel.SendAsync(new SubmitCode("document.body.innerHTML += '<div>howdy</div>'"));

        var result = await htmlKernel.SendAsync(new RequestValue("html", "text/html"));

        var events = result.KernelEvents.ToSubscribedList();
        events
            .Should()
            .ContainSingle<ValueProduced>()
            .Which
            .FormattedValue
            .Value
            .Should()
            .Contain("<div>howdy</div>");
    }

    // FIX: (HtmlKernelTests) 
    private async Task<Kernel> CreateHtmlProxyKernelAsync()
    {
        var connector = new PlaywrightKernelConnector();

        var proxy = await connector.CreateKernelAsync("html");

        return proxy;
    }
}