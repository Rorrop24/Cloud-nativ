function handler(event) {
    var request = event.request;
    var lastSegment = request.uri.split('/').pop();
    if (!lastSegment || lastSegment.indexOf('.') === -1) {
        request.uri = '/index.html';
    }
    return request;
}
