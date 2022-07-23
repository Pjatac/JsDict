$(document).ready(function(){
    $('#spinner').hide();

    $('.nav-tabs a').on('click', function(){
        $(this).tab('show');
    });

    $('#dictsList').on('click', function(e){
        e.preventDefault();
        $('.nav-tabs a[href="#learn"]').tab('show');
    });
});

$.fn.showFlex = function() {
    this.css('display','flex');
}
